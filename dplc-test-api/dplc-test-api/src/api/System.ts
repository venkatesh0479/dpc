import SystemInfo from './system-info.json';

/**
 * System class
 */
 export class System {

    /**
     * Get the build number of the system
     */
    public static getBuildNumber() : string {

        // Return the build number
        return SystemInfo.buildNumber;
    }
}