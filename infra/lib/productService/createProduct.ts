import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Product } from "./types";
import { v4 as uuidv4 } from "uuid";

const AWS_REGION = process.env.AWS_REGION;
const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME;

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

interface CreateProductRequest {
    title: string;
    description: string;
    price: number;
}

export async function createProduct(event: any) {
    try {        
        const { title, description, price }: CreateProductRequest = event;

        // Validate required fields
        if (!title || !description || price === undefined || price === null) {
            throw new Error("Missing required fields: title, description, and price are required");
        }

        // Validate price is a positive number
        if (typeof price !== 'number' || price <= 0) {
            throw new Error("Price must be a positive number");
        }

        // Generate a unique ID for the product
        const productId = uuidv4();

        // Create the product object
        const product: Product = {
            id: productId,
            title: title.trim(),
            description: description.trim(),
            price: price,
        };

        // Save the product to DynamoDB
        await docClient.send(new PutCommand({
            TableName: PRODUCTS_TABLE_NAME,
            Item: product,
        }));

        return product;
    } catch (error) {
        console.error('Error creating product:', error);
        throw error;
    }
}
