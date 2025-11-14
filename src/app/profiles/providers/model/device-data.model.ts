export interface ResidentData {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  documentNumber: string;
  providerId: number;
  userId: number;
  username: string;
  password: string;
}

export interface SubscriptionData {
  id: number;
  startDate: string;
  endDate: string;
  status: string;
  deviceId: number;
  residentId: number;
}

export interface SensorEvent {
  id: number;
  eventType: string;
  qualityValue: string;
  levelValue: string;
  deviceId: number;
}

export interface ResidentSensorData {
  resident: ResidentData;
  subscriptions: SubscriptionData[];
  sensorEvents: SensorEvent[];
}
