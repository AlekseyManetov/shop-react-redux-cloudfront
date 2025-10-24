import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import csv from 'csv-parser';

const s3Client = new S3Client({});

export async function importFileParser(event: any) {
    // Expecting S3 event records
    for (const record of event.Records ?? []) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

        const command = new GetObjectCommand({ Bucket: bucket, Key: key });
        const response = await s3Client.send(command);

        const bodyStream = response.Body as unknown as NodeJS.ReadableStream;

        await new Promise<void>((resolve, reject) => {
            bodyStream
                .pipe(csv())
                .on('data', (data) => {
                    console.log('Parsed record:', data);
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
    }
}


