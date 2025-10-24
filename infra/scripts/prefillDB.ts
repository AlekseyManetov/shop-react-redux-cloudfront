import { config } from 'dotenv';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { carData } from '../lib/productService/data';
import { Product, Stock } from '../lib/productService/types';

// Load environment variables from .env file
config();

// Get table names from environment variables with fallbacks
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const STOCK_TABLE = process.env.STOCK_TABLE;
const AWS_REGION = process.env.AWS_REGION;

const client = new DynamoDBClient({ region: AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function prefillProductsTable(): Promise<void> {
    console.log('Starting to prefill products table...');
    
    try {
        for (const car of carData) {
            const product = {
                id: car.id,
                title: car.title,
                description: car.description,
                price: car.price
            };

            await docClient.send(new PutCommand({
                TableName: PRODUCTS_TABLE,
                Item: product
            }));
        }

        console.log(`Successfully inserted ${carData.length} products into the products table`);
    } catch (error) {
        console.error('Error inserting products:', error);
        throw error;
    }
}

async function prefillStockTable(): Promise<void> {
    console.log('Starting to prefill stock table...');
    
    try {
        for (const car of carData) {
            const stockItem = {
                product_id: car.id,
                count: car.count
            };

            await docClient.send(new PutCommand({
                TableName: STOCK_TABLE,
                Item: stockItem
            }));
        }

        console.log(`Successfully inserted ${carData.length} stock items into the stock table`);
    } catch (error) {
        console.error('Error inserting stock items:', error);
        throw error;
    }
}

async function prefillDatabase(): Promise<void> {
    try {
        console.log('Starting database prefill process...');
        console.log(`Using products table: ${PRODUCTS_TABLE}`);
        console.log(`Using stock table: ${STOCK_TABLE}`);
        console.log(`Using AWS region: ${AWS_REGION}`);
        
        // Prefill products table
        await prefillProductsTable();
        
        // Prefill stock table
        await prefillStockTable();
        
        console.log('Database prefill completed successfully!');
    } catch (error) {
        console.error('Database prefill failed:', error);
        process.exit(1);
    }
}

prefillDatabase();

