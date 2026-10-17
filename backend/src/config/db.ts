import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const mongoUri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB_NAME;

  if (!mongoUri || !dbName) {
    throw new Error(
      'MONGO_URI and MONGO_DB_NAME must be configured in the environment.',
    );
  }

  try {
    await mongoose.connect(mongoUri, {
      dbName,
    });

    console.log(`MongoDB connected to database "${dbName}".`);
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    throw error;
  }
}