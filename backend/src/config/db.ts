import mongoose from 'mongoose';
import { env } from './env';

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);
  console.log(`[db] connected to ${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}`);
}
