
/**
 * Command class
 */
 export class HttpUtil {

    /**
     * HTTP client
     */
    constructor() {
    }

    /**
     * Generate success response
     * @param data 
     */
    public static successResponse(data: any) : any {

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Headers" : "content-type, authorization",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
            },
            body: JSON.stringify(data)
        };
    }

    /**
     * Generate error response
     * @param data 
     */
     public static errorResponse(statusCode: string, errorMsg: string) : any {

        return  {
            statusCode: statusCode,
            body: JSON.stringify(errorMsg)
        };
    }

}