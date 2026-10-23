export type VisibilityStatus = 'public' | 'private' | 'draft';

export interface SocialLink {
  label: string;
  url: string;
  handle?: string;
}

export interface LifeMilestone {
  year: string;
  title: string;
  description: string;
}

export interface SiteProfile {
  gardenName: string;
  gardenSubtitle: string;
  ownerName: string;
  ownerTitle: string;
  avatar: string;
  signature: string;
  bio: string;
  heroTitle: string;
  heroIntro: string;
  heroImage: string;
  heroQuote: string;
  seasonNote: string;
  currentLocation: string;
  currentReading: string;
  currentListening: string;
  aboutContent: string; // Rich HTML content for About page
  interests: string[];
  socialLinks: SocialLink[];
  milestones: LifeMilestone[];
  homeModules: {
    showFeaturedArticles: boolean;
    showMoments: boolean;
    showGallery: boolean;
    showTravel: boolean;
    showCollections: boolean;
    showAlmanac: boolean;
  };
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  content: string; // Rich HTML from WYSIWYG editor
  category: string;
  tags: string[];
  status: VisibilityStatus;
  isPinned: boolean;
  isFeatured: boolean;
  location?: string;
  weather?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface Moment {
  id: string;
  content: string;
  images: string[];
  tags: string[];
  mood?: string;
  weather?: string;
  location?: string;
  status: 'public' | 'private';
  createdAt: string;
}

export interface PhotoItem {
  id: string;
  url: string;
  title: string;
  caption?: string;
  takenAt: string;
  camera?: string;
  lens?: string;
  location?: string;
}

export interface Album {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  category: string;
  location: string;
  date: string;
  status: 'public' | 'private';
  photos: PhotoItem[];
  createdAt: string;
}

export interface TravelFootprint {
  id: string;
  destination: string;
  region: string;
  country: string;
  coordinates: {
    x: number; // Percentage 0-100 on custom artistic map
    y: number; // Percentage 0-100 on custom artistic map
    lat: number;
    lng: number;
  };
  startDate: string;
  endDate: string;
  summary: string;
  story: string;
  coverImage: string;
  photos: string[];
  relatedArticleId?: string;
  relatedAlbumId?: string;
  tags: string[];
  status: 'public' | 'private';
  createdAt: string;
}

export type CollectionType = 'gear' | 'film' | 'book' | 'music' | 'site' | string;

export interface CollectionItem {
  id: string;
  title: string;
  creator: string; // Author, brand, director, artist
  category: CollectionType;
  categoryLabel: string;
  coverImage: string;
  rating: number; // 1 to 5
  review: string;
  experienceNote?: string;
  specsOrMeta?: string; // e.g., "2023 · 124分钟" or "静电容 45g · 雪白无刻"
  externalLink?: string;
  tags: string[];
  recordedDate: string;
  status: 'public' | 'private';
  favorite: boolean;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  sourceId: string;
  type: 'article' | 'moment' | 'travel' | 'collection' | 'album';
  typeLabel: string;
  date: string;
  year: string;
  month: string;
  day: string;
  title: string;
  summary: string;
  coverImage?: string;
  tags: string[];
  status: VisibilityStatus;
  meta?: string;
}

export interface GardenDatabase {
  version: number;
  lastUpdated: string;
  profile: SiteProfile;
  articles: Article[];
  moments: Moment[];
  albums: Album[];
  travels: TravelFootprint[];
  collections: CollectionItem[];
  customCategories: {
    articleCategories: string[];
    collectionCategories: Array<{ id: string; label: string }>;
  };
}
