import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Trophy, 
  Target, 
  Zap, 
  Clock, 
  Star, 
  Award, 
  TrendingUp, 
  CheckCircle,
  Flame,
  Crown,
  Medal,
  Calendar
} from 'lucide-react';
import { OrderWithDetails } from '@shared/schema';
import { motion, AnimatePresence } from 'framer-motion';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: 'speed' | 'quality' | 'volume' | 'streak';
  threshold: number;
  current: number;
  unlocked: boolean;
  points: number;
  color: string;
}

interface DailyProgress {
  date: string;
  ordersCompleted: number;
  targetOrders: number;
  revenueGenerated: number;
  targetRevenue: number;
  averageTime: number;
  targetTime: number;
  streak: number;
}

interface TeamMember {
  id: string;
  name: string;
  totalPoints: number;
  level: number;
  completedToday: number;
  currentStreak: number;
  badges: string[];
}

export default function GamifiedProgress() {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  
  const { data: orders = [] } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders"],
  });

  // Calculate progress metrics from authentic order data
  const calculateProgress = (): DailyProgress => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const todayOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startOfDay;
    });

    const completedToday = orders.filter(order => 
      order.status === 'PICKED_UP' && 
      new Date(order.pickedUpAt || order.updatedAt || order.createdAt) >= startOfDay
    );

    const revenueToday = completedToday.reduce((sum, order) => sum + order.price, 0);
    
    // Calculate average completion time from status history
    const avgTime = completedToday.length > 0 
      ? completedToday.reduce((sum, order) => sum + order.estimatedHours, 0) / completedToday.length
      : 0;

    // Calculate streak from last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      return date;
    });

    let currentStreak = 0;
    for (const date of last7Days) {
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const dayCompletions = orders.filter(order => 
        order.status === 'PICKED_UP' && 
        new Date(order.pickedUpAt || order.updatedAt || order.createdAt) >= dayStart &&
        new Date(order.pickedUpAt || order.updatedAt || order.createdAt) < dayEnd
      );

      if (dayCompletions.length > 0) {
        currentStreak++;
      } else {
        break;
      }
    }

    return {
      date: today.toISOString().split('T')[0],
      ordersCompleted: completedToday.length,
      targetOrders: 15, // Daily target
      revenueGenerated: revenueToday,
      targetRevenue: 2500, // Daily revenue target
      averageTime: avgTime,
      targetTime: 4, // Target average hours per order
      streak: currentStreak
    };
  };

  // Generate achievements based on real performance
  const generateAchievements = (): Achievement[] => {
    const progress = calculateProgress();
    const completedOrders = orders.filter(order => order.status === 'PICKED_UP');
    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.price, 0);
    const highValueOrders = completedOrders.filter(order => order.price >= 500);
    const quickOrders = completedOrders.filter(order => order.estimatedHours <= 2);

    return [
      {
        id: 'speed-demon',
        title: 'Speed Demon',
        description: 'Complete 10 orders in under 2 hours each',
        icon: <Zap className="h-5 w-5" />,
        category: 'speed',
        threshold: 10,
        current: quickOrders.length,
        unlocked: quickOrders.length >= 10,
        points: 500,
        color: 'text-yellow-600 bg-yellow-100'
      },
      {
        id: 'revenue-crusher',
        title: 'Revenue Crusher',
        description: 'Generate $10,000 in total revenue',
        icon: <Trophy className="h-5 w-5" />,
        category: 'quality',
        threshold: 10000,
        current: totalRevenue,
        unlocked: totalRevenue >= 10000,
        points: 1000,
        color: 'text-green-600 bg-green-100'
      },
      {
        id: 'high-roller',
        title: 'High Roller',
        description: 'Complete 5 orders worth $500+ each',
        icon: <Crown className="h-5 w-5" />,
        category: 'quality',
        threshold: 5,
        current: highValueOrders.length,
        unlocked: highValueOrders.length >= 5,
        points: 750,
        color: 'text-purple-600 bg-purple-100'
      },
      {
        id: 'consistency-king',
        title: 'Consistency King',
        description: 'Maintain a 7-day completion streak',
        icon: <Flame className="h-5 w-5" />,
        category: 'streak',
        threshold: 7,
        current: progress.streak,
        unlocked: progress.streak >= 7,
        points: 600,
        color: 'text-red-600 bg-red-100'
      },
      {
        id: 'volume-master',
        title: 'Volume Master',
        description: 'Complete 50 total orders',
        icon: <Target className="h-5 w-5" />,
        category: 'volume',
        threshold: 50,
        current: completedOrders.length,
        unlocked: completedOrders.length >= 50,
        points: 800,
        color: 'text-blue-600 bg-blue-100'
      },
      {
        id: 'daily-champion',
        title: 'Daily Champion',
        description: 'Complete 15 orders in a single day',
        icon: <Medal className="h-5 w-5" />,
        category: 'volume',
        threshold: 15,
        current: progress.ordersCompleted,
        unlocked: progress.ordersCompleted >= 15,
        points: 400,
        color: 'text-orange-600 bg-orange-100'
      }
    ];
  };

  const progress = calculateProgress();
  const achievements = generateAchievements();
  const unlockedAchievements = achievements.filter(a => a.unlocked);
  const totalPoints = unlockedAchievements.reduce((sum, a) => sum + a.points, 0);
  const currentLevel = Math.floor(totalPoints / 1000) + 1;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Daily Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Daily Progress Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Orders Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Orders Completed</span>
                <span className="text-sm text-muted-foreground">
                  {progress.ordersCompleted}/{progress.targetOrders}
                </span>
              </div>
              <Progress 
                value={(progress.ordersCompleted / progress.targetOrders) * 100} 
                className="h-3"
              />
              <div className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">
                  {Math.round((progress.ordersCompleted / progress.targetOrders) * 100)}% of daily goal
                </span>
              </div>
            </div>

            {/* Revenue Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Revenue Generated</span>
                <span className="text-sm text-muted-foreground">
                  ${progress.revenueGenerated.toLocaleString()}/${progress.targetRevenue.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={(progress.revenueGenerated / progress.targetRevenue) * 100} 
                className="h-3"
              />
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">
                  {Math.round((progress.revenueGenerated / progress.targetRevenue) * 100)}% of revenue target
                </span>
              </div>
            </div>

            {/* Streak Counter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current Streak</span>
                <div className="flex items-center gap-1">
                  <Flame className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-bold">{progress.streak} days</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Keep completing orders daily to maintain your streak!
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Level and Points */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-500" />
              Level & Experience
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">Level {currentLevel}</span>
                <Badge variant="secondary" className="text-sm">
                  {totalPoints} XP
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progress to Level {currentLevel + 1}</span>
                  <span>{totalPoints % 1000}/1000 XP</span>
                </div>
                <Progress value={(totalPoints % 1000) / 10} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Achievement Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Unlocked Achievements</span>
                <span className="text-2xl font-bold">{unlockedAchievements.length}/{achievements.length}</span>
              </div>
              <Progress value={(unlockedAchievements.length / achievements.length) * 100} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {achievements.length - unlockedAchievements.length} achievements remaining
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Achievements Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Medal className="h-5 w-5 text-gold" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {achievements.map((achievement) => (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg border transition-all ${
                    achievement.unlocked 
                      ? 'border-green-200 bg-green-50 shadow-md' 
                      : 'border-gray-200 bg-gray-50 opacity-75'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${
                      achievement.unlocked ? achievement.color : 'text-gray-400 bg-gray-100'
                    }`}>
                      {achievement.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold text-sm ${
                        achievement.unlocked ? 'text-gray-900' : 'text-gray-500'
                      }`}>
                        {achievement.title}
                        {achievement.unlocked && (
                          <CheckCircle className="inline-block h-4 w-4 text-green-500 ml-1" />
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {achievement.description}
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span>Progress</span>
                          <span>{Math.min(achievement.current, achievement.threshold)}/{achievement.threshold}</span>
                        </div>
                        <Progress 
                          value={(achievement.current / achievement.threshold) * 100} 
                          className="h-1"
                        />
                      </div>
                      {achievement.unlocked && (
                        <Badge variant="secondary" className="text-xs mt-2">
                          +{achievement.points} XP
                        </Badge>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
