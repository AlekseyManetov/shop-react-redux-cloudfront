import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import { Construct } from 'constructs';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sqs from "aws-cdk-lib/aws-sqs";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";

export class ProductServiceStack extends cdk.Stack {
    public readonly catalogItemsQueue: sqs.Queue;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const productsTable = new dynamodb.Table(this, "ProductsTable", {
            tableName: "products",
            partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
        });

        const stockTable = new dynamodb.Table(this, "StockTable", {
            tableName: "stock",
            partitionKey: { name: "product_id", type: dynamodb.AttributeType.STRING },
        });

        const productsListLambdaFunction = new lambda.Function(this, 'lambda-function', {
            runtime: lambda.Runtime.NODEJS_20_X,
            memorySize: 128,
            timeout: cdk.Duration.seconds(5),
            handler: 'getProductsList.getProductsList',
            code: lambda.Code.fromAsset(path.join(__dirname, './')),
            environment: {
                PRODUCTS_TABLE_NAME: productsTable.tableName,
                STOCK_TABLE_NAME: stockTable.tableName,
            },
        });

        productsTable.grantReadData(productsListLambdaFunction);
        stockTable.grantReadData(productsListLambdaFunction);

        const getProductByIdLambdaFunction = new lambda.Function(this, 'get-product-by-id-lambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            memorySize: 128,
            timeout: cdk.Duration.seconds(5),
            handler: 'getProductsById.getProductById',
            code: lambda.Code.fromAsset(path.join(__dirname, './')),
            environment: {
                PRODUCTS_TABLE_NAME: productsTable.tableName,
                STOCK_TABLE_NAME: stockTable.tableName,
            },
        });

        productsTable.grantReadData(getProductByIdLambdaFunction);
        stockTable.grantReadData(getProductByIdLambdaFunction);

        const createProductLambdaFunction = new NodejsFunction(this, 'create-product-lambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            memorySize: 128,
            timeout: cdk.Duration.seconds(5),
            entry: path.join(__dirname, 'createProduct.ts'),
            handler: 'createProduct',
            environment: {
                PRODUCTS_TABLE_NAME: productsTable.tableName,
                STOCK_TABLE_NAME: stockTable.tableName,
            },
        });

        productsTable.grantWriteData(createProductLambdaFunction);

        const api = new apigateway.RestApi(this, "products-api", {
            restApiName: "Products API Gateway",
            description: "This API serves Products Lambda functions."
        });

        const productsListLambdaIntegration = new apigateway.LambdaIntegration(productsListLambdaFunction, {
            integrationResponses: [
                {
                    statusCode: '200',
                }
            ],
            proxy: false,
        });

        const createProductLambdaIntegration = new apigateway.LambdaIntegration(createProductLambdaFunction, {
            integrationResponses: [
                {
                    statusCode: '201',
                }
            ],
            proxy: false,
        });

        const productResource = api.root.addResource("products");
        productResource.addMethod('GET', productsListLambdaIntegration, {
            methodResponses: [{ statusCode: '200' }]
        });

        productResource.addMethod('POST', createProductLambdaIntegration, {
            methodResponses: [{ statusCode: '201' }]
        });

        productResource.addCorsPreflight({
            allowOrigins: ['https://dsh6xyfcrg9sh.cloudfront.net/'],
            allowMethods: ['GET', 'POST'],
        });

        const getProductByIdLambdaIntegration = new apigateway.LambdaIntegration(getProductByIdLambdaFunction, {
            integrationResponses: [
                {
                    statusCode: '200',
                }
            ],
            proxy: false,
        });

        const productIdResource = productResource.addResource('{productId}');
        productIdResource.addMethod('GET', getProductByIdLambdaIntegration);


        // SQS
        this.catalogItemsQueue = new sqs.Queue(this, "catalogItemsQueue");

        // SNS Topic for product creation notifications
        const createProductTopic = new sns.Topic(this, "createProductTopic", {
            displayName: "Product Creation Notifications",
            topicName: "createProductTopic"
        });

        // Email subscription
        createProductTopic.addSubscription(
            new subscriptions.EmailSubscription("aliaksei_manetau@epam.com")
        );

        const catalogBatchProcessLambda = new NodejsFunction(this, "catalogBatchProcess", {
            runtime: lambda.Runtime.NODEJS_20_X,
            memorySize: 1024,
            timeout: cdk.Duration.seconds(5),
            entry: path.join(__dirname, 'catalogBatchProcess.ts'),
            handler: 'catalogBatchProcess',
            environment: {
                PRODUCTS_TABLE: productsTable.tableName,
                STOCK_TABLE: stockTable.tableName,
                CREATE_PRODUCT_TOPIC_ARN: createProductTopic.topicArn,
            },
        });

        catalogBatchProcessLambda.addEventSource(new SqsEventSource(this.catalogItemsQueue, { batchSize: 5 }));

        // Grant permissions to DynamoDB tables
        productsTable.grantWriteData(catalogBatchProcessLambda);
        stockTable.grantWriteData(catalogBatchProcessLambda);

        // Grant permissions to SNS topic
        createProductTopic.grantPublish(catalogBatchProcessLambda);

        // Output the queue URL for reference
        new cdk.CfnOutput(this, 'CatalogItemsQueueUrl', {
            value: this.catalogItemsQueue.queueUrl,
            description: 'URL of the catalog items SQS queue',
        });

        // Output the SNS topic ARN for reference
        new cdk.CfnOutput(this, 'CreateProductTopicArn', {
            value: createProductTopic.topicArn,
            description: 'ARN of the SNS topic for product creation notifications',
        });
    }
}