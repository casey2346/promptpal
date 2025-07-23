import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export interface IUser extends Document {
  username: string;
  displayName?: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  tenantId?: string;
  isActive: boolean;
  resetToken?: string;
  tokenExpires?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
  generateJWT(): string;
}

const UserSchema: Schema<IUser> = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      minlength: 3,
      maxlength: 32,
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
    tenantId: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    resetToken: {
      type: String,
    },
    tokenExpires: {
      type: Date,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// 🔐 Hash password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err as Error);
  }
});

// 🔐 Compare password
UserSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// 🔑 Generate JWT token
UserSchema.methods.generateJWT = function (): string {
  const payload = {
    id: this._id,
    username: this.username,
    role: this.role,
    tenantId: this.tenantId,
  };
  return jwt.sign(payload, process.env.JWT_SECRET || 'mock-secret', {
    expiresIn: '7d',
  });
};

// ✅ Export model
const UserModel: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
export default UserModel;
