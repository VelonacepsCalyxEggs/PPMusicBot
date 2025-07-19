// Base DTOs for related models
export class ArtistDto {
  id: string;
  name: string;
  Albums?: AlbumDto[];
}

export class AlbumDto {
  id: string;
  name: string;
  pathToCoverArt?: string;
  Artists?: ArtistDto[];
}

export class RoleDto {
  id: string;
  name: string;
}

export class UserDto {
  username: string;
  roles?: RoleDto[];
  avatar?: string;
}

export class MusicMetadataDto {
  musicId: string;
  pathToCoverArt?: string;
  publisher?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  discNumber?: number;
  composer?: string;
  lyricist?: string;
  conductor?: string;
  remixer?: string;
  bpm?: number;
  key?: string;
  language?: string;
  copyright?: string;
  license?: string;
  isrc?: string;
  encodedBy?: string;
  encoderSoftware?: string;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
}

export class MusicFileDto {
  id: string;
  filePath: string;
  fileSize: number;
  fileHash: string;
}

// Main Music DTO
export class MusicDto {
  id: string;
  title: string;
  duration: number;
  uploadedAt: Date;
  artist: ArtistDto;
  album: AlbumDto;
  uploader?: UserDto;
  MusicMetadata?: MusicMetadataDto;
  MusicFile: MusicFileDto[];
}

// Base scored item with common properties
interface ScoredItem {
  score: number;
  resultType: 'track' | 'album' | 'artist';
}

// Specific scored item types
export interface ScoredTrack extends MusicDto, ScoredItem {
  resultType: 'track';
}

export interface ScoredAlbum extends AlbumDto, ScoredItem {
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
