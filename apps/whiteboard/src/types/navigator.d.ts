// Type definitions for navigator.userAgentData
interface NavigatorUAData {
	platform: string;
	brands: Array<{
		brand: string;
		version: string;
	}>;
	mobile: boolean;
}

interface Navigator {
	userAgentData?: NavigatorUAData;
}
