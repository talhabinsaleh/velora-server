/**
 * Gives an existing account admin access. Admins can never be created through public sign-up,
 * so this script (run by someone with database access) is the secure way to assign the role.
 *
 *   npm run make-admin -- someone@example.com
 */
import mongoose from "mongoose";
import { connectDB } from "../src/config/db";
import { User } from "../src/models/User";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run make-admin -- <email>");
  await connectDB();
  const result = await User.updateOne({ email }, { $set: { role: "admin", isBlocked: false } });
  if (result.matchedCount === 0) throw new Error(`No account found for ${email}. Sign up first.`);
  console.log(`${email} is now an admin.`);
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
