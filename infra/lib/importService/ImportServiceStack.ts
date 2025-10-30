import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';

export class ImportServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const bucket = new s3.Bucket(this, 'ImportBucket', {
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            cors: [{
                allowedOrigins: ['https://dsh6xyfcrg9sh.cloudfront.net'],
                allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.HEAD, s3.HttpMethods.GET],
                allowedHeaders: ['*'],
                exposedHeaders: ['ETag'],
                maxAge: 3000,
            }],
        });

        const importProductsFileLambda = new NodejsFunction(this, 'import-products-file-lambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            memorySize: 128,
            timeout: cdk.Duration.seconds(5),
            entry: path.join(__dirname, 'importProductsFile.ts'),
            handler: 'importProductsFile',
            environment: {
                BUCKET_NAME: bucket.bucketName,
            },
        });

        bucket.grantReadWrite(importProductsFileLambda);

        // Parser Lambda triggered by S3 ObjectCreated for uploaded/*
        const importFileParserLambda = new NodejsFunction(this, 'import-file-parser-lambda', {
            runtime: lambda.Runtime.NODEJS_20_X,
            memorySize: 128,
            timeout: cdk.Duration.seconds(10),
            entry: path.join(__dirname, 'importFileParser.ts'),
            handler: 'importFileParser',
        });

        bucket.grantRead(importFileParserLambda);
        bucket.addEventNotification(
            s3.EventType.OBJECT_CREATED,
            new s3n.LambdaDestination(importFileParserLambda),
            { prefix: 'uploaded/' }
        );

        const api = new apigateway.RestApi(this, "import-api", {
            restApiName: "Import API Gateway",
            description: "This API serves Import Lambda functions.",
            defaultCorsPreflightOptions: {
                allowOrigins: ['https://dsh6xyfcrg9sh.cloudfront.net'],
                allowMethods: ['GET', 'OPTIONS'],
              },
        });

        const importLambdaIntegration = new apigateway.LambdaIntegration(importProductsFileLambda, {
            requestTemplates: {
                'application/json': `{"name":"$input.params('name')"}`,
            },
            integrationResponses: [
                {
                    statusCode: '200',
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Origin': '\'https://dsh6xyfcrg9sh.cloudfront.net\'',
                    },
                },
            ],
            proxy: false,
        });

        const importResource = api.root.addResource("import");
        importResource.addMethod('GET', importLambdaIntegration, {
            methodResponses: [{
                statusCode: '200',
                responseParameters: {
                    'method.response.header.Access-Control-Allow-Origin': true,
                }
            }]
        });
    }
}