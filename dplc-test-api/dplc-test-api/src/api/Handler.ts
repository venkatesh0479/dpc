import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { HttpUtil } from "./HttpUtil";
import { System } from "./System";

/**
 * Handle get build number events
 * @param event 
 * @returns 
 */
export const getBuildNumber = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {

    // Return build number
    return HttpUtil.successResponse({ 
        buildNumber: System.getBuildNumber()
    });
};