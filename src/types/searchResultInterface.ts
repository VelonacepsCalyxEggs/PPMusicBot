import { Album, MusicTrack } from 'velonaceps-music-shared';
// Base DTOs for related models


// Base scored item with common properties
interface ScoredItem {
  score: number;
  resultType: 'track' | 'album' | 'artist';
}

// Specific scored item types
export interface ScoredTrack extends MusicTrack, ScoredItem {
  resultType: 'track';
}

export interface ScoredAlbum extends Album, ScoredItem {
  resultType: 'album';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ScoredArtist extends Record<string, any>, ScoredItem {
  id: string;
  name: string;
  resultType: 'artist';
}

// Combined union type for the combined array
export type ScoredSearchItem = ScoredTrack | ScoredAlbum | ScoredArtist;

// Main search results type
export interface SearchResultsDto {
  tracks: ScoredTrack[];
  albums: ScoredAlbum[];
  artists: ScoredArtist[];
  combined: ScoredSearchItem[];
}
