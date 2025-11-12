import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';

export async function basicAuthorizer(event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
    try {
        const authorizationToken = event.authorizationToken;
        
        if (!authorizationToken) {
            throw new Error('Unauthorized');
        }

        if (!authorizationToken.startsWith('Basic ')) {
            return generatePolicy('user', 'Deny', event.methodArn || '*');
        }

        const encodedCredentials = authorizationToken.replace('Basic ', '');
        const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
        const [username, password] = decodedCredentials.split(':');

        if (!username || !password) {
            return generatePolicy('user', 'Deny', event.methodArn || '*');
        }

        const expectedPassword = process.env[username];

        if (!expectedPassword || expectedPassword !== password) {
            return generatePolicy(username, 'Deny', event.methodArn || '*');
        }

        return generatePolicy(username, 'Allow', event.methodArn || '*');
    } catch (error) {
        // Re-throw to return 401 status code
        throw new Error('Unauthorized');
    }
}

function generatePolicy(principalId: string, effect: 'Allow' | 'Deny', resource: string): APIGatewayAuthorizerResult {
    return {
        principalId,
        policyDocument: {
            Version: '2012-10-17',
            Statement: [
                {
                    Action: 'execute-api:Invoke',
                    Effect: effect,
                    Resource: resource
                }
            ]
        }
    };
}

