import { User } from '../models/User.js';
import { PendingSignup } from '../models/PendingSignup.js';
import { PendingPasswordReset } from '../models/PendingPasswordReset.js';

// Migrate old required-email accounts to optional email/phone contacts before serving requests.
export async function ensureUserContactIndexes() {
  const collection = User.collection;
  const indexes = await collection.indexes();
  for (const field of ['email', 'phone']) {
    const oldUniqueIndex = indexes.find(index => index.key?.[field] === 1 && index.unique && !index.sparse);
    if (oldUniqueIndex) await collection.dropIndex(oldUniqueIndex.name);
  }
  await User.updateMany({ email: '' }, { $unset: { email: 1 } });
  await User.updateMany({ phone: '' }, { $unset: { phone: 1 } });
  await User.createIndexes();
  await PendingSignup.createIndexes();
  await PendingPasswordReset.createIndexes();
}
