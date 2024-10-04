import { DynamoDBClient, PutItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const client = new DynamoDBClient({});
const table = process.env.TABLE_NAME ?? '';

const addItem = async (url: string): Promise<number> => {
    const short_url = Math.floor(Date.now() / 1000);
    const params = {
        TableName: table,
        Item: {
            "short_url": { "S": short_url.toString() },
            "url": { "S": url },
        }
    };
    try {
        console.log("Adding a new item...");
        const command = new PutItemCommand(params);
        const res = await client.send(command);
        console.log("res: ", res);
        return short_url;
    }
    catch (e) {
        console.log("error", e);
        throw e;
    }
};

const getItem = async (short_url: string): Promise<string> => {
    console.log(short_url);
    short_url = short_url.slice(1);
    console.log(short_url);
    const params = {
        KeyConditionExpression: "short_url = :v1",
        ExpressionAttributeValues: {
            ":v1": { "S": short_url }
        },
        TableName: table
    };
    try {
        console.log("entering try");
        const command = new QueryCommand(params);
        const res = await client.send(command);
        if (res.Items && res.Items.length > 0 && res.Items[0].url && res.Items[0].url.S) {
            return res.Items[0].url.S;
        }
        throw new Error("URL not found");
    }
    catch (e) {
        console.log("error", e);
        throw e;
    }
};

const urlValidation = (url: string): boolean => {
    const regex = /^https:\/\/.*\..*/;
    console.log("url", url);
    return !regex.test(url);
};

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    let response: string;
    const host = event.headers.host;
    
    if (event.requestContext.http.method === 'GET' && event.rawPath !== '/url-short') {
        try {
            response = await getItem(event.rawPath);
            return {
                statusCode: 301,
                headers: {
                    Location: response
                }
            };
        } catch (error) {
            return {
                statusCode: 404,
                body: "Short URL not found"
            };
        }
    }
    else if (event.requestContext.http.method === 'POST') {
        console.log("1event", event);
        console.log(JSON.stringify("2event", event));
        
        if (!event.body) {
            return {
                statusCode: 400,
                body: "Missing request body"
            };
        }
        
        const body = JSON.parse(event.body);
        
        if (urlValidation(body.url)) {
            return {
                statusCode: 400,
                body: "url example 'https://www.google.com'"
            };
        }
        
        try {
            const shortUrl = await addItem(body.url);
            response = `${host}/${shortUrl}`;
            return {
                statusCode: 200,
                body: response
            };
        } catch (error) {
            return {
                statusCode: 500,
                body: "Error creating short URL"
            };
        }
    }
    
    return {
        statusCode: 405,
        body: "Method not allowed"
    };
};