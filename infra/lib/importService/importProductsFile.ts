import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";

const BUCKET_NAME = process.env.BUCKET_NAME as string;

export async function importProductsFile(event: any) {
    const fileName = event?.name;

    if (!fileName || typeof fileName !== 'string') {
        throw new Error('Query parameter "name" is required');
    }

    const decodedFileName = decodeURIComponent(fileName);
    const objectKey = `uploaded/${decodedFileName}`;

    const s3Client = new S3Client({});
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectKey,
        ContentType: 'text/csv',
    });

    return await getSignedUrl(s3Client, command, {expiresIn: 60});
}