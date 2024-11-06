import middy from "@middy/core";
import httpEventNormalizer from "@middy/http-event-normalizer";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const region = process.env.AWS_REGION;

const dbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

const baseHandler = async (event, context) => {
  const { id } = event.queryStringParameters;

  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "id is required" }),
    };
  }

  try {
    const params = {
      TableName: process.env.TABLE_NAME,
      Key: { id },
    };

    const command = new GetCommand(params);
    const data = await dbClient.send(command);
    const profile = data.Item;
    if (!profile) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "User not found" }),
      };
    }

    delete profile.password;

    return {
      statusCode: 200,
      body: JSON.stringify(data.Item),
    };
  } catch (err) {
    console.error("Error getting profile from DynamoDB", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};

export default middy(baseHandler)
  .use(httpEventNormalizer())
