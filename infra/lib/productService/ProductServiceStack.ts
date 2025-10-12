import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import { Construct } from 'constructs';

export class ProductServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const productsListLambdaFunction = new lambda.Function(this, 'lambda-function', {
            runtime: lambda.Runtime.NODEJS_20_X,
            memorySize: 128,
            timeout: cdk.Duration.seconds(5),
            handler: 'getProductsList.getProductsList',
            code: lambda.Code.fromAsset(path.join(__dirname, './')),
        });

        const getProductByIdLambdaFunction = new lambda.Function(this, 'get-product-by-id-lambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            memorySize: 128,
            timeout: cdk.Duration.seconds(5),
            handler: 'getProductsById.getProductById',
            code: lambda.Code.fromAsset(path.join(__dirname, './')),
        });

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

        const productResource = api.root.addResource("products");
        productResource.addMethod('GET', productsListLambdaIntegration, {
            methodResponses: [{ statusCode: '200' }]
        });

        productResource.addCorsPreflight({
            allowOrigins: ['https://dsh6xyfcrg9sh.cloudfront.net/'],
            allowMethods: ['GET'],
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