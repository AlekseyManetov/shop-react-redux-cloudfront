import { SQSEvent } from "aws-lambda";
import {DynamoDBClient, PutItemCommand} from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { v4 as uuidv4 } from "uuid";

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const STOCK_TABLE = process.env.STOCK_TABLE;
const AWS_REGION = process.env.AWS_REGION;
const CREATE_PRODUCT_TOPIC_ARN = process.env.CREATE_PRODUCT_TOPIC_ARN;

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const snsClient = new SNSClient({ region: process.env.AWS_REGION });

export async function catalogBatchProcess(event: SQSEvent) {
    for (const record of event.Records) {
        const product = JSON.parse(record.body);

        console.log("Received from queue product:", { ...product });

        const id = uuidv4();

        const putProductCommand = new PutItemCommand({
            TableName: PRODUCTS_TABLE,
            Item: {
                id: { S: id },
                title: { S: product.title },
                description: { S: product.description },
                price: { N: product.price },
            },
        });

        const putStockCommand = new PutItemCommand({
            TableName: STOCK_TABLE,
            Item: {
                product_id: { S: id },
                count: { N: product.count },
            },
        });

        const [productResult, stockResult] = await Promise.all([
            dynamoDB.send(putProductCommand),
            dynamoDB.send(putStockCommand),
        ]);

        console.log(`Product ${product.title} created successfully with ID: ${id}`);

        // Send SNS notification
        try {
            const snsMessage = {
                subject: "New Product Created",
                message: `A new product "${product.title}" has been created successfully.\n\nProduct Details:\n- ID: ${id}\n- Title: ${product.title}\n- Description: ${product.description}\n- Price: $${product.price}\n- Stock Count: ${product.count}`
            };

            const publishCommand = new PublishCommand({
                TopicArn: CREATE_PRODUCT_TOPIC_ARN,
                Subject: snsMessage.subject,
                Message: snsMessage.message,
            });

            await snsClient.send(publishCommand);
            console.log(`SNS notification sent for product: ${product.title}`);
        } catch (error) {
            console.error("Error sending SNS notification:", error);
            // Don't throw error to avoid failing the entire batch
        }
    }
}