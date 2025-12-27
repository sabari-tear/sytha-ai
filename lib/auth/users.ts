// Simple user management
// In production, use a proper database with hashed passwords

interface StoredUser {
  id: string;
  email: string;
  name: string;
  password: string; // In production, this should be hashed
  createdAt: number;
}

// In-memory user store (in production, use database)
const userStore = new Map<string, StoredUser>();
const emailIndex = new Map<string, string>(); // email -> userId

class UserManager {
  async create(email: string, name: string, password: string): Promise<StoredUser> {
    // Check if user already exists
    if (emailIndex.has(email.toLowerCase())) {
      throw new Error('User already exists');
    }

    const userId = this.generateUserId();
    const user: StoredUser = {
      id: userId,
      email: email.toLowerCase(),
      name,
      password, // In production, hash this with bcrypt
      createdAt: Date.now(),
    };

    userStore.set(userId, user);
    emailIndex.set(email.toLowerCase(), userId);

    return user;
  }

  async findByEmail(email: string): Promise<StoredUser | null> {
    const userId = emailIndex.get(email.toLowerCase());
    if (!userId) {
      return null;
    }
    return userStore.get(userId) || null;
  }

  async findById(userId: string): Promise<StoredUser | null> {
    return userStore.get(userId) || null;
  }

  async validateCredentials(email: string, password: string): Promise<StoredUser | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    // In production, use bcrypt.compare
    if (user.password !== password) {
      return null;
    }

    return user;
  }

  private generateUserId(): string {
    return 'user_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

export const users = new UserManager();