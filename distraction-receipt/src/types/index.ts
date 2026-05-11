export interface AppConfig {
  notificationTime: string
  distractionApps: string[]
  productiveApps: string[]
}

export interface DailyStats {
  distractions: {
    name: string
    time: string
  }[]
  work: {
    name: string
    time: string
  }[]
  efficiency: number
  streak: number
  date: string
  totalWastedTime: string
  totalProductiveTime: string
}

export interface WeeklyStats {
  totalTime: string
  efficiency: number
  date: string
  weekData: {
    day: string
    hours: number
    percentage: number
  }[]
  categories: {
    name: string
    time: string
  }[]
}
