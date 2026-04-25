export type XtreamCredentials = {
  username: string
  password: string
}

export type XtreamUserInfo = {
  user_info: {
    username: string
    password: string
    message: string
    auth: number
    status: string
    exp_date: number
    is_trial: number
    active_cons: number
    max_connections: number
    created_at: number
    allowed_output_formats: string[]
  }
  server_info: {
    url: string
    port: number
    https_port: number
    server_protocol: string
    timezone: string
    timestamp_now: number
    time_now: string
  }
}

export type XtreamLiveCategory = {
  category_id: string
  category_name: string
  parent_id: number
}

export type XtreamLiveStream = {
  num: number
  name: string
  stream_type: string
  stream_id: number
  stream_icon: string
  epg_channel_id: string
  added: number
  category_id: string
  tv_archive: number
  direct_source: string
  tv_archive_duration: number
  rtmp_source: string
}

export type XtreamVodCategory = {
  category_id: string
  category_name: string
  parent_id: number
}

export type XtreamVodStream = {
  num: number
  name: string
  stream_type: string
  stream_id: number
  stream_icon: string
  rating: string
  rating_5based: number
  added: number
  category_id: string
  container_extension: string
  custom_sid: string
  direct_source: string
}

export type XtreamSeriesCategory = {
  category_id: string
  category_name: string
  parent_id: number
}

export type XtreamSeries = {
  num: number
  name: string
  series_id: number
  cover: string
  plot: string
  cast: string
  director: string
  genre: string
  releaseDate: string
  last_modified: string
  rating: string
  rating_5based: number
  backdrop_path: string
  youtube_trailer: string
  episode_run_time: string
  category_id: string
}

export type XtreamVodInfo = {
  info: {
    name: string
    plot: string
    description: string
    genre: string
    cast: string
    director: string
    releasedate: string
    duration: string
    rating: string
    rating_5based: number
    backdrop_path: string
    movie_image: string
    youtube_trailer: string
    country: string
    languages: string
    tmdb_id: string
    poster_path: string
  }
  movie_data?: {
    stream_id: number
    name: string
    added: number
    category_id: string
    container_extension: string
    custom_sid: string
    direct_source: string
    rating: string
    rating_5based: number
    plot: string
    cast: string
    director: string
    genre: string
    releasedate: string
    duration: string
    backdrop_path: string
    movie_image: string
  }
}

export type XtreamSeriesInfo = {
  info: XtreamSeries
  episodes: Record<
    string,
    Array<{
      id: number
      episode_num: number
      title: string
      container_extension: string
      info: {
        movie_image: string
        plot: string
        duration_secs: number
        backdrop: Array<{ src: string }>
        cast: string
        director: string
        rating: string
        rating_5based: number
        releasedate: string
      }
    }>
  >
}
