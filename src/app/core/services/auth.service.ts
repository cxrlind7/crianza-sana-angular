import { Injectable, signal } from '@angular/core';
import {
  User,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase/firebase-app';

const DEFAULT_AVATARS = [
  'https://csdkids-images.s3.us-east-2.amazonaws.com/defaultAvatar1.jpg',
  'https://csdkids-images.s3.us-east-2.amazonaws.com/defaultAvatar2.jpg',
  'https://csdkids-images.s3.us-east-2.amazonaws.com/defaultAvatar3.jpg',
  'https://csdkids-images.s3.us-east-2.amazonaws.com/defaultAvatar4.jpg',
  'https://csdkids-images.s3.us-east-2.amazonaws.com/defaultAvatar5.jpg',
  'https://csdkids-images.s3.us-east-2.amazonaws.com/defaultAvatar6.jpg',
  'https://csdkids-images.s3.us-east-2.amazonaws.com/defaultAvatar7.jpg',
];

function getRandomAvatar(): string {
  return DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<User | null>(null);

  constructor() {
    onAuthStateChanged(auth, (user) => {
      this.currentUser.set(user);
    });
  }

  async register(email: string, password: string, name: string): Promise<User> {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await updateProfile(user, { displayName: name, photoURL: getRandomAvatar() });
    await sendEmailVerification(user);
    return user;
  }

  async login(email: string, password: string): Promise<User> {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  }

  logout(): Promise<void> {
    return signOut(auth);
  }
}
