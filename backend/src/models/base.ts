import mongoose, { Schema, SchemaDefinition } from 'mongoose';
import { fmtDate } from '../utils/pyDates';

/** Auto-increment counters (replaces PostgreSQL SERIAL). One document per collection. */
const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });
export const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema, 'counters');

export async function nextId(name: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' }).lean();
  return (doc as any).seq;
}

/** Keep the counter >= a given value (used after importing rows that carry explicit ids). */
export async function bumpCounter(name: string, atLeast: number) {
  await Counter.findOneAndUpdate({ _id: name }, { $max: { seq: atLeast } }, { upsert: true });
}

export const todayDateString = (): string => fmtDate(new Date());

type Opts = { serial?: boolean };

/**
 * Create a model whose documents keep an integer `id` (auto-increment) like the original SQL tables,
 * so URLs / ordering / references behave the same. `_id` stays Mongo's ObjectId but is never sent to clients.
 */
export function makeModel(name: string, collection: string, fields: SchemaDefinition, opts: Opts = {}) {
  const { serial = true } = opts;
  const def: SchemaDefinition = { ...(serial ? { id: { type: Number, unique: true, index: true } } : {}), ...fields };
  const schema = new Schema(def, { id: false, versionKey: false, collection, minimize: false });
  if (serial) {
    schema.pre('validate', async function () {
      if ((this as any).isNew && ((this as any).id === undefined || (this as any).id === null)) {
        (this as any).id = await nextId(collection);
      }
    });
  }
  return (mongoose.models[name] as mongoose.Model<any>) || mongoose.model<any>(name, schema);
}
