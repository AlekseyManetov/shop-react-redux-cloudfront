import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import csv from 'csv-parser';

const s3Client = new S3Client({});
const sqsClient = new SQSClient({});

export async function importFileParser(event: any) {
    const queueUrl = process.env.CATALOG_ITEMS_QUEUE_URL;
    
    if (!queueUrl) {
        throw new Error('CATALOG_ITEMS_QUEUE_URL environment variable is not set');
    }

    console.log('Using SQS queue URL:', queueUrl);

    // Expecting S3 event records
    for (const record of event.Records ?? []) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        const response = await s3Client.send(command);

        const bodyStream = response.Body as unknown as NodeJS.ReadableStream;

        const records: any[] = [];
        
        await new Promise<void>((resolve, reject) => {
            bodyStream
                .pipe(csv())
                .on('data', (data) => {
                    console.log('Parsed record:', data);
                    records.push(data);
                })
                .on('end', () => {
                    console.log(`Finished parsing ${key}`);
                    resolve();
                })
                .on('error', (err) => {
                    console.error('CSV parse error:', err);
                    reject(err);
                });
        });

        // Send all records to SQS
        for (const record of records) {
            try {
                console.log('Sending message to SQS...');
                const sendMessageCommand = new SendMessageCommand({
                    QueueUrl: queueUrl,
                    MessageBody: JSON.stringify(record),
                });
                const result = await sqsClient.send(sendMessageCommand);
                console.log('Message sent successfully:', result.MessageId);
            } catch (error) {
                console.error('Error sending message to SQS:', error);
                throw error;
            }
        }
    }
}


