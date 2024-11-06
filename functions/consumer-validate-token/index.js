import middy from "@middy/core";
import httpEventNormalizer from "@middy/http-event-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const region = process.env.AWS_REGION;

const dbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

const baseHandler = async (event, context) => {};

export default middy(baseHandler)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser());
