import { Duration, Stack, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { AttributeType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { Architecture, LogFormat, Runtime } from "aws-cdk-lib/aws-lambda";
import { ApiKey, LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";

export class TinyTreasureTradingStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { stage, region } = props;

    const functionProps = {
      bundling: {
        minify: true,
        externalModules: ["@aws-sdk/*"],
      },
      logRetention: RetentionDays.ONE_DAY,
      architecture: Architecture.ARM_64,
      loggingFormat: LogFormat.JSON,
      runtime: Runtime.NODEJS_20_X,
      handler: "default",
    };

    // ***********************************************************************************
    // Tables
    // ***********************************************************************************

    const consumersTable = new Table(this, `consumers-table`, {
      tableName: `${id}-consumers-table`,
      partitionKey: { name: "id", type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    consumersTable.addGlobalSecondaryIndex({
      indexName: `${id}-consumer-index`,
      partitionKey: { name: "email", type: AttributeType.STRING },
    });

    // ***********************************************************************************
    // Functions
    // ***********************************************************************************

    const consumerRegister = new NodejsFunction(this, "consumer-register", {
      entry: "functions/consumer-register/index.js",
      timeout: Duration.seconds(29),
      functionName: `${id}-consumer-register`,
      memorySize: 128,
      environment: {
        TABLE_NAME: consumersTable.tableName,
        INDEX_NAME: `${id}-consumer-index`,
      },
      ...functionProps,
    });

    consumersTable.grant(
      consumerRegister,
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Scan",
      "dynamodb:Query"
    );

    const consumerGetProfile = new NodejsFunction(this, "consumer-get-profile", {
      entry: "functions/consumer-get-profile/index.js",
      timeout: Duration.seconds(29),
      functionName: `${id}-consumer-get-profile`,
      memorySize: 128,
      environment: {
        TABLE_NAME: consumersTable.tableName,
        INDEX_NAME: `${id}-consumer-index`,
      },
      ...functionProps,
    });

    consumersTable.grant(
      consumerGetProfile,
      "dynamodb:GetItem",
      "dynamodb:Query"
    );

    const consumerAuthenticate = new NodejsFunction(this, "consumer-authenticate", {
      entry: "functions/consumer-authenticate/index.js",
      timeout: Duration.seconds(29),
      functionName: `${id}-consumer-authenticate`,
      memorySize: 128,
      environment: {
        TABLE_NAME: consumersTable.tableName,
        INDEX_NAME: `${id}-consumer-index`,
      },
      ...functionProps,
    });

    consumersTable.grant(
      consumerAuthenticate,
      "dynamodb:GetItem",
      "dynamodb:Query",
    );

    // ***********************************************************************************
    // API
    // ***********************************************************************************

    const restApi = new RestApi(this, "rest-api", {
      defaultMethodOptions: {
        apiKeyRequired: true,
      },
      deployOptions: {
        stageName: stage,
      },
      restApiName: `${id}-api`,
    });

    const apiKey = new ApiKey(this, "api-key", {
      apiKeyName: `${id}-api-key`,
      description: "API Key for API",
    });

    const apiUsagePlan = restApi.addUsagePlan("usage-plan", {
      name: `${id}-usage-plan`,
      throttle: {
        rateLimit: 2,
        burstLimit: 2,
      },
      apiStages: [
        {
          stage: restApi.deploymentStage,
        },
      ],
    });

    apiUsagePlan.addApiKey(apiKey);

    const apiRoutes = restApi.root.addResource("api");

    const consumerRoutes = apiRoutes.addResource("consumer");
    consumerRoutes.addMethod("POST", new LambdaIntegration(consumerRegister));
    consumerRoutes.addMethod("GET", new LambdaIntegration(consumerGetProfile));

    const loginRoutes = consumerRoutes.addResource("login");
    loginRoutes.addMethod("POST", new LambdaIntegration(consumerAuthenticate));
  }
}
