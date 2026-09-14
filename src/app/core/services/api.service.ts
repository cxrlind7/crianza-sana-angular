import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  collection,
  getDocs,
  query,
  doc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { filterPublished } from '../utils/schedule';
import { db } from '../firebase/firebase-app';

export interface Banner {
  id: string;
  active: string;
  altText: string;
  imageSrc: string;
  publishAt?: string;
}

export interface Ad {
  id: string;
  active: string;
  altText: string;
  imageSrc: string;
  publishAt?: string;
}

export interface EventItem {
  id: string;
  altText?: string;
  buttonText?: string;
  imageSrc?: string;
  message?: string;
  phone?: string;
  showButton?: string;
  type?: string;
  publishAt?: string;
}

export interface CampaignData {
  img: string;
  show: boolean;
}

export interface Blog {
  id: string;
  authorImage?: string;
  authorName?: string;
  category?: string;
  categoryColor?: string;
  date: string;
  description?: string;
  imageUrl?: string;
  orden?: number;
  text?: string;
  title: string;
  title1?: string;
  publishAt?: string;
}

export interface Video {
  id: string;
  date: string;
  parsedDate: Date;
  publishAt?: string;
  [key: string]: unknown;
}

export interface Programa {
  id: string;
  temas?: string[];
  participantes?: number[];
  evento?: { fecha: string; hora?: string; mensaje?: string };
  colores?: { primario?: string; secundario?: string; titulo?: string };
  [key: string]: unknown;
}

export interface Social {
  id?: string;
  iconClass: string;
  link: string;
}

export interface Person {
  id: string;
  name?: string;
  socials?: Social[];
  [key: string]: unknown;
}

export interface Comment {
  id: string;
  [key: string]: unknown;
}

export interface GalleryImage {
  id: string;
  url: string;
  title?: string;
  comments: Comment[];
  [key: string]: unknown;
}

export interface Gallery {
  id: string;
  name: string;
  date?: string | { seconds?: number; _seconds?: number };
  images: GalleryImage[];
  [key: string]: unknown;
}

export interface Subscriber {
  id: string;
  email: string;
  subscribedAt: string | null;
}

export interface SubscribeResult {
  success: boolean;
  alreadyExists?: boolean;
  error?: string;
  message?: string;
}

export interface NewsletterPayload {
  type: string;
  title: string;
  description?: string;
  link?: string;
}

export interface NewsletterResult {
  success: boolean;
  sent: number;
  errors: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendUrl;

  async getBanner(): Promise<Banner | null> {
    try {
      const banners = await firstValueFrom(
        this.http.get<Banner[]>(`${this.baseUrl}/api/firestore/banner`),
      );
      const published = filterPublished(banners);
      return published.find((b) => b.active === 'true') ?? null;
    } catch (error) {
      console.error('❌ Error obteniendo banner:', error);
      return null;
    }
  }

  async getAd(): Promise<Ad[]> {
    try {
      const ads = await firstValueFrom(this.http.get<Ad[]>(`${this.baseUrl}/api/firestore/ad`));
      return filterPublished(ads).filter((a) => a.active === 'true');
    } catch (error) {
      console.error('❌ Error obteniendo ad:', error);
      return [];
    }
  }

  async getEvents(): Promise<EventItem[]> {
    try {
      const events = await firstValueFrom(
        this.http.get<EventItem[]>(`${this.baseUrl}/api/firestore/eventos`),
      );
      return filterPublished(events);
    } catch (error) {
      console.error('❌ Error obteniendo la colección de eventos del backend:', error);
      return [];
    }
  }

  async getCampaignData(): Promise<CampaignData | null> {
    try {
      return await firstValueFrom(
        this.http.get<CampaignData | null>(`${this.baseUrl}/api/firestore/campaign`),
      );
    } catch (error) {
      console.error('❌ Error getting campaign data from backend:', error);
      return null;
    }
  }

  async getCollection<T = unknown>(
    collectionName: string,
    orderField = 'orden',
    orderDirection: 'asc' | 'desc' = 'asc',
  ): Promise<T[]> {
    try {
      return await firstValueFrom(
        this.http.get<T[]>(`${this.baseUrl}/api/firestore/collection/${collectionName}`, {
          params: { orderField, orderDirection },
        }),
      );
    } catch (error) {
      console.error(`❌ Error obteniendo la colección "${collectionName}" del backend:`, error);
      throw error;
    }
  }

  async getBlogs(): Promise<Blog[]> {
    try {
      return await firstValueFrom(this.http.get<Blog[]>(`${this.baseUrl}/api/firestore/blogs`));
    } catch (error) {
      console.error('❌ Error getting blogs data from backend:', error);
      return [];
    }
  }

  async getPrograms(): Promise<Programa[]> {
    try {
      return await firstValueFrom(
        this.http.get<Programa[]>(`${this.baseUrl}/api/firestore/programs`),
      );
    } catch (error) {
      console.error('❌ Error obteniendo la colección de temas del backend:', error);
      throw error;
    }
  }

  async getVideos(): Promise<Video[]> {
    try {
      const videos = await firstValueFrom(
        this.http.get<Video[]>(`${this.baseUrl}/api/firestore/videos`),
      );
      return videos.map((v) => ({ ...v, parsedDate: new Date(v.parsedDate) }));
    } catch (error) {
      console.error('❌ Error obteniendo videos del backend:', error);
      throw error;
    }
  }

  async updateVideo(id: string, data: Partial<Video>): Promise<boolean> {
    try {
      await firstValueFrom(this.http.put(`${this.baseUrl}/api/firestore/videos/${id}`, data));
      return true;
    } catch (error) {
      console.error(`❌ Error actualizando video ${id}:`, error);
      return false;
    }
  }

  async createVideo(data: Partial<Video>): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ id: string }>(`${this.baseUrl}/api/firestore/videos`, data),
      );
      return response.id;
    } catch (error) {
      console.error('❌ Error creando video:', error);
      return null;
    }
  }

  async deleteVideo(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.delete(`${this.baseUrl}/api/firestore/videos/${id}`));
      return true;
    } catch (error) {
      console.error(`❌ Error eliminando video ${id}:`, error);
      return false;
    }
  }

  async updateProgram(id: string, data: Partial<Programa>): Promise<boolean> {
    try {
      await firstValueFrom(this.http.put(`${this.baseUrl}/api/firestore/programs/${id}`, data));
      return true;
    } catch (error) {
      console.error(`❌ Error actualizando programa ${id}:`, error);
      return false;
    }
  }

  async updateBlog(blogId: string, data: Partial<Blog>): Promise<boolean> {
    try {
      await firstValueFrom(this.http.put(`${this.baseUrl}/api/firestore/blogs/${blogId}`, data));
      return true;
    } catch (error) {
      console.error(`❌ Error actualizando blog ${blogId}:`, error);
      return false;
    }
  }

  async createBlog(data: Partial<Blog>): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ id: string }>(`${this.baseUrl}/api/firestore/blogs`, data),
      );
      return response.id;
    } catch (error) {
      console.error('❌ Error creating blog:', error);
      return null;
    }
  }

  async getPeople(collectionName: string): Promise<Person[]> {
    if (collectionName === 'people') {
      try {
        return await firstValueFrom(
          this.http.get<Person[]>(`${this.baseUrl}/api/firestore/people`),
        );
      } catch (error) {
        console.error('❌ Error obteniendo people del backend:', error);
        throw error;
      }
    }

    try {
      const q = query(collection(db, collectionName));
      const querySnapshot = await getDocs(q);
      const people = await Promise.all(
        querySnapshot.docs.map(async (document) => {
          const personData: Person = { id: document.id, ...document.data() };
          const socialsSnapshot = await getDocs(collection(db, `${collectionName}/${document.id}/socials`));
          personData.socials = socialsSnapshot.docs.map((s) => ({ id: s.id, ...s.data() }) as Social);
          return personData;
        }),
      );
      return people;
    } catch (error) {
      console.error(`❌ Error obteniendo la colección "${collectionName}":`, error);
      throw error;
    }
  }

  async getReels(personId: string | number): Promise<string[]> {
    try {
      return await firstValueFrom(
        this.http.get<string[]>(`${this.baseUrl}/api/firestore/reels`, { params: { personId } }),
      );
    } catch (error) {
      console.error(`❌ Error obteniendo reels del backend para persona ${personId}:`, error);
      throw error;
    }
  }

  async getComments(blogId: string): Promise<Comment[]> {
    try {
      return await firstValueFrom(
        this.http.get<Comment[]>(`${this.baseUrl}/api/firestore/blogs/${blogId}/comments`),
      );
    } catch (error) {
      console.error(`❌ Error obteniendo los comentarios del blog ${blogId} del backend:`, error);
      throw error;
    }
  }

  async addComment(blogId: string, commentData: Record<string, unknown>): Promise<string> {
    const commentsRef = collection(doc(db, 'blogs', blogId), 'comments');
    const docRef = await addDoc(commentsRef, { ...commentData, createdAt: serverTimestamp() });
    return docRef.id;
  }

  async deleteComment(blogId: string, commentId: string): Promise<void> {
    await deleteDoc(doc(db, 'blogs', blogId, 'comments', commentId));
  }

  async getGalleries(): Promise<Gallery[]> {
    try {
      return await firstValueFrom(
        this.http.get<Gallery[]>(`${this.baseUrl}/api/firestore/galleries`),
      );
    } catch (error) {
      console.error('❌ Error obteniendo las galerías del backend:', error);
      throw error;
    }
  }

  async getImageComments(galeriaId: string, imageId: string): Promise<Comment[]> {
    try {
      return await firstValueFrom(
        this.http.get<Comment[]>(
          `${this.baseUrl}/api/firestore/galleries/${galeriaId}/images/${imageId}/comments`,
        ),
      );
    } catch (error) {
      console.error(`❌ Error obteniendo los comentarios de la imagen ${imageId}:`, error);
      throw error;
    }
  }

  async addImageComment(
    galeriaId: string,
    imageId: string,
    commentData: Record<string, unknown>,
  ): Promise<string> {
    const commentsRef = collection(doc(db, 'galerias', galeriaId, 'fotos', imageId), 'comments');
    const docRef = await addDoc(commentsRef, { ...commentData, createdAt: serverTimestamp() });
    return docRef.id;
  }

  async deleteCommentGaleria(galeriaId: string, imageId: string, commentId: string): Promise<void> {
    await deleteDoc(doc(db, 'galerias', galeriaId, 'fotos', imageId, 'comments', commentId));
  }

  async getCommentsVideo(videoId: string): Promise<Comment[]> {
    try {
      return await firstValueFrom(
        this.http.get<Comment[]>(`${this.baseUrl}/api/firestore/videos/${videoId}/comments`),
      );
    } catch (error) {
      console.error(`❌ Error obteniendo comentarios del video ${videoId}:`, error);
      throw error;
    }
  }

  async addCommentVideo(videoId: string, commentData: Record<string, unknown>): Promise<string> {
    const commentsRef = collection(doc(db, 'programas', videoId), 'comments');
    const docRef = await addDoc(commentsRef, { ...commentData, createdAt: serverTimestamp() });
    return docRef.id;
  }

  async deleteCommentVideo(videoId: string, commentId: string): Promise<void> {
    await deleteDoc(doc(db, 'programas', videoId, 'comments', commentId));
  }

  async getAllAds(): Promise<Ad[]> {
    try {
      return await firstValueFrom(this.http.get<Ad[]>(`${this.baseUrl}/api/firestore/ad`));
    } catch (error) {
      console.error('❌ Error obteniendo ads:', error);
      return [];
    }
  }

  async updateAd(id: string, data: Partial<Ad>): Promise<boolean> {
    try {
      await firstValueFrom(this.http.put(`${this.baseUrl}/api/firestore/ad/${id}`, data));
      return true;
    } catch (error) {
      console.error(`❌ Error actualizando ad ${id}:`, error);
      return false;
    }
  }

  async createAd(data: Partial<Ad>): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ id: string }>(`${this.baseUrl}/api/firestore/ad`, data),
      );
      return response.id;
    } catch (error) {
      console.error('❌ Error creando ad:', error);
      return null;
    }
  }

  async deleteAd(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.delete(`${this.baseUrl}/api/firestore/ad/${id}`));
      return true;
    } catch (error) {
      console.error(`❌ Error eliminando ad ${id}:`, error);
      return false;
    }
  }

  async getAllBanners(): Promise<Banner[]> {
    try {
      return await firstValueFrom(
        this.http.get<Banner[]>(`${this.baseUrl}/api/firestore/banner/all`),
      );
    } catch (error) {
      console.error('❌ Error obteniendo banners:', error);
      return [];
    }
  }

  async updateBanner(id: string, data: Partial<Banner>): Promise<boolean> {
    try {
      await firstValueFrom(this.http.put(`${this.baseUrl}/api/firestore/banner/${id}`, data));
      return true;
    } catch (error) {
      console.error(`❌ Error actualizando banner ${id}:`, error);
      return false;
    }
  }

  async createBanner(data: Partial<Banner>): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ id: string }>(`${this.baseUrl}/api/firestore/banner`, data),
      );
      return response.id;
    } catch (error) {
      console.error('❌ Error creando banner:', error);
      return null;
    }
  }

  async deleteBanner(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.delete(`${this.baseUrl}/api/firestore/banner/${id}`));
      return true;
    } catch (error) {
      console.error(`❌ Error eliminando banner ${id}:`, error);
      return false;
    }
  }

  async getAllEventos(): Promise<EventItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<EventItem[]>(`${this.baseUrl}/api/firestore/eventos`),
      );
    } catch (error) {
      console.error('❌ Error obteniendo eventos:', error);
      return [];
    }
  }

  async updateEvento(id: string, data: Partial<EventItem>): Promise<boolean> {
    try {
      await firstValueFrom(this.http.put(`${this.baseUrl}/api/firestore/eventos/${id}`, data));
      return true;
    } catch (error) {
      console.error(`❌ Error actualizando evento ${id}:`, error);
      return false;
    }
  }

  async createEvento(data: Partial<EventItem>): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ id: string }>(`${this.baseUrl}/api/firestore/eventos`, data),
      );
      return response.id;
    } catch (error) {
      console.error('❌ Error creando evento:', error);
      return null;
    }
  }

  async deleteEvento(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.delete(`${this.baseUrl}/api/firestore/eventos/${id}`));
      return true;
    } catch (error) {
      console.error(`❌ Error eliminando evento ${id}:`, error);
      return false;
    }
  }

  async getAllCampanas(): Promise<CampaignData[]> {
    try {
      return await firstValueFrom(
        this.http.get<CampaignData[]>(`${this.baseUrl}/api/firestore/campana/all`),
      );
    } catch (error) {
      console.error('❌ Error obteniendo campañas:', error);
      return [];
    }
  }

  async updateCampana(id: string, data: Partial<CampaignData>): Promise<boolean> {
    try {
      await firstValueFrom(this.http.put(`${this.baseUrl}/api/firestore/campana/${id}`, data));
      return true;
    } catch (error) {
      console.error(`❌ Error actualizando campaña ${id}:`, error);
      return false;
    }
  }

  async subscribeEmail(email: string): Promise<SubscribeResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<SubscribeResult>(`${this.baseUrl}/api/subscribers`, { email }),
      );
      return { ...response, success: true };
    } catch (error: unknown) {
      const httpError = error as { status?: number; error?: { error?: string } };
      if (httpError.status === 409) {
        return { success: false, alreadyExists: true, error: httpError.error?.error };
      }
      console.error('❌ Error al suscribir:', error);
      return { success: false, error: 'Error al guardar suscripción' };
    }
  }

  async getSubscribers(): Promise<Subscriber[]> {
    try {
      return await firstValueFrom(
        this.http.get<Subscriber[]>(`${this.baseUrl}/api/subscribers`),
      );
    } catch (error) {
      console.error('❌ Error obteniendo suscriptores:', error);
      return [];
    }
  }

  async deleteSubscriber(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.delete(`${this.baseUrl}/api/subscribers/${id}`));
      return true;
    } catch (error) {
      console.error('❌ Error eliminando suscriptor:', error);
      return false;
    }
  }

  async sendNewsletter(payload: NewsletterPayload): Promise<NewsletterResult> {
    return firstValueFrom(
      this.http.post<NewsletterResult>(`${this.baseUrl}/api/send-newsletter`, payload),
    );
  }
}
