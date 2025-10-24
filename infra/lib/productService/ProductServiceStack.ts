import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import { Construct } from 'constructs';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export class ProductServiceStack extends cdk.Stack {
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
    }
}