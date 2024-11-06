import middy from "@middy/core";
import httpEventNormalizer from "@middy/http-event-normalizer";
import httpJsonBodyParser from "@middy/http-json-body-parser";
import httpValidator from "@middy/validator";

import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import bcrypt from "bcryptjs";
import { ulid } from "ulid";

const region = process.env.AWS_REGION;

const dbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

const eventSchema = {
  type: "object",
  properties: {
    body: {
      type: "object",
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string" },
        username: { type: "string" },
      },
      required: ["email", "password", "username"],
    },
  },
};

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
    console.log(data);

    return data.Items.length > 0;
  } catch (err) {
    console.error("Error querying DynamoDB", {
      message: err.message,
      code: err.code,
      stack: err.stack,
      time: err.time,
      requestId: err.requestId,
      statusCode: err.statusCode,
      retryable: err.retryable,
    });
  }
};

const hashPassword = (password) => {
  const saltRounds = 10;
  const salt = bcrypt.genSaltSync(saltRounds);
  const hash = bcrypt.hashSync(password, salt);
  return hash;
};

const baseHandler = async (event, context) => {
  console.log(JSON.stringify(event));
  const { email, password, username } = event.body;

  const userExist = await checkUserExistsByEmail(email);
  if (userExist) {
    return {
      statusCode: 409,
      body: JSON.stringify("User already exists"),
    };
  }
  const id = ulid();
  console.log(id);

  const hash = hashPassword(password);
  console.log(hash);

  const user = {
    id,
    email,
    username,
    password: hash,
  };
  const params = {
    TableName: process.env.TABLE_NAME,
    Item: user,
  };

  const command = new PutCommand(params);
  await dbClient.send(command);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Created Successfully", id }),
  };
};

export default middy(baseHandler)
  .use(httpEventNormalizer())
  .use(httpJsonBodyParser());
//   .use(httpValidator({ eventSchema }));
