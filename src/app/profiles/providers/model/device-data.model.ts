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
  // backend may use either deviceId or sensorId; accept both (sensorId is used by your backend)
  deviceId?: number;
  sensorId?: number;
  residentId: number;
}

export interface SensorEvent {
  id: number;
  eventType: string;
  qualityValue: string;
  levelValue: string;
  // sometimes events reference the sensorId instead of deviceId
  deviceId?: number;
  sensorId?: number;
}

export interface ResidentSensorData {
  resident: ResidentData;
  subscriptions: SubscriptionData[];
  sensorEvents: SensorEvent[];
}
