import { App } from "aws-cdk-lib";
import { TinyTreasureTradingStack } from "./stacks/index.js";
import dotenv from 'dotenv';

dotenv.config();

const app = new App();

const stage = process.env.AWS_STAGE;
const region = process.env.AWS_REGION;

const tinyTreasureTradingStack = new TinyTreasureTradingStack(
  app,
  `${stage}-tiny-treasure-trading`,
  {
    description: "Tiny Treasure Trading Service",
    stage,
    env: {
        account: process.env.AWS_ACCOUNT,
        region
    }
  }
);
