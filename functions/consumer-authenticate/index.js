import middy from "@middy/core";
import httpEventNormalizer from "@middy/http-event-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const region = process.env.AWS_REGION;

const dbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

const secretKey = "supersecret";

const checkUserExistsByEmail = async (email) => {
  try {
    const params = {
      TableName: process.env.TABLE_NAME,
      IndexName: process.env.INDEX_NAME,
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": email,
      },
    };

    const command = new QueryCommand(params);
    const data = await dbClient.send(command);

    if (!data || !data.Items || data.Items.length === 0) {
      return undefined;
    }

    return data.Items[0];
  } catch (error) {
    console.error("Error querying user by email: ", error);
    throw error;
  }
};

const generateTokens = (profile) => {};

const checkPassword = (password, hash) => {
  return bcrypt.compareSync(password, hash);
};

const baseHandler = async (event, context) => {
  const { email, password } = event.body;

  const profile = await checkUserExistsByEmail(email);
  console.log(profile);
  if (!profile) {
    return {
      statusCode: 404,
      body: JSON.stringify("User not found"),
    };
  }

  if (!checkPassword(password, profile.password)) {
    return {
      statusCode: 403,
      body: JSON.stringify("User not authenticated"),
    };
  }

  delete profile.password;

  const accessToken = jwt.sign({ profile }, secretKey, { expiresIn: "1h" });
  const refreshToken = jwt.sign({ profile }, secretKey, { expiresIn: "1d" });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "OK",
      accessToken,
      refreshToken,
      id: profile.id
    }),
  };
};

export default middy(baseHandler)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser());
