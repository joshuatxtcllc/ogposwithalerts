import { useStatsStore } from '@/store/useStatsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, Calendar, TrendingUp, Flame, Star } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CompletionStats() {
  const { getStats } = useStatsStore();
  const stats = getStats();

  const achievements = [
    {
      id: 'daily-10',
      title: 'Daily Achiever',
      description: 'Complete 10 orders in one day',
      achieved: stats.daily >= 10,
      progress: Math.min(stats.daily, 10),
      target: 10,
      icon: Target,
    },
    {
      id: 'streak-7',
      title: 'Week Warrior',
      description: 'Complete orders for 7 consecutive days',
      achieved: stats.streak >= 7,
      progress: Math.min(stats.streak, 7),
      target: 7,
      icon: Flame,
    },
    {
      id: 'total-100',
      title: 'Century Club',
      description: 'Complete 100 total orders',
      achieved: stats.total >= 100,
      progress: Math.min(stats.total, 100),
      target: 100,
      icon: Trophy,
    },
    {
      id: 'streak-30',
      title: 'Monthly Master',
      description: 'Complete orders for 30 consecutive days',
      achieved: stats.streak >= 30,
      progress: Math.min(stats.streak, 30),
      target: 30,
      icon: Star,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-jade-500/10 to-jade-600/5 border-jade-500/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-jade-400" />
              <div>
                <p className="text-sm text-gray-400">Today</p>
                <p className="text-2xl font-bold text-white">{stats.daily}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Total</p>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Flame className="h-4 w-4 text-orange-400" />
              <div>
                <p className="text-sm text-gray-400">Streak</p>
                <p className="text-2xl font-bold text-white">{stats.streak}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Trophy className="h-4 w-4 text-purple-400" />
              <div>
                <p className="text-sm text-gray-400">Best</p>
                <p className="text-2xl font-bold text-white">{stats.bestStreak}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Achievements */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {achievements.map((achievement) => {
            const Icon = achievement.icon;
            const progressPercentage = (achievement.progress / achievement.target) * 100;
            
            return (
              <motion.div
                key={achievement.id}
                className={`p-3 rounded-lg border transition-all ${
                  achievement.achieved 
                    ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30' 
                    : 'bg-gray-700/50 border-gray-600'
                }`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      achievement.achieved ? 'bg-yellow-500/20' : 'bg-gray-600/20'
                    }`}>
                      <Icon className={`h-4 w-4 ${
                        achievement.achieved ? 'text-yellow-400' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <h4 className={`font-medium ${
                        achievement.achieved ? 'text-yellow-300' : 'text-white'
                      }`}>
                        {achievement.title}
                      </h4>
                      <p className="text-sm text-gray-400">{achievement.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {achievement.achieved ? (
                      <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                        Unlocked
                      </Badge>
                    ) : (
                      <div className="text-right">
                        <p className="text-sm text-gray-300">
                          {achievement.progress}/{achievement.target}
                        </p>
                        <div className="w-16 h-2 bg-gray-600 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-jade-500 to-blue-500 transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
