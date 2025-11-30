export interface SubscriptionModel {
  id: number;
  startDate: string;
  endDate: string;
  status: string;
  deviceId: number;
  waterTankSize?: number;
}