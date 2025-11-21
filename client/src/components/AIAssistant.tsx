import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Brain, X, Send, BarChart3, Clock, AlertTriangle, TrendingUp, Trash2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiRequest } from '@/lib/queryClient';
import type { AIMessage, WorkloadAnalysis } from '@shared/schema';

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [urgentAlerts, setUrgentAlerts] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { lastMessage } = useWebSocket();

  // Fetch AI analysis
  const { data: analysis } = useQuery<WorkloadAnalysis>({
    queryKey: ["/api/ai/analysis"],
    refetchInterval: 30000,
  });

  // Fetch AI alerts
  const { data: alertsData } = useQuery<{ alerts: AIMessage[] }>({
    queryKey: ["/api/ai/alerts"],
    refetchInterval: 60000,
  });

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('POST', '/api/ai/chat', { message });
      return response.json();
    },
    onSuccess: (data) => {
      const aiResponse: AIMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: data.response,
        timestamp: new Date(),
        severity: 'info'
      };
      setMessages(prev => [...prev, aiResponse]);
    },
  });

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle WebSocket messages for AI alerts and analysis
  useEffect(() => {
    if (lastMessage?.type === 'ai-alerts') {
      const alerts = lastMessage.data;
      const urgentCount = alerts.filter((alert: AIMessage) => alert.severity === 'urgent').length;
      setUrgentAlerts(prev => prev + urgentCount);

      if (isOpen) {
        setMessages(prev => [...prev, ...alerts]);
      }
    }

    if (lastMessage?.type === 'ai-analysis') {
      // Trigger refetch of analysis data
      queryClient.invalidateQueries({ queryKey: ["/api/ai/analysis"] });
    }
  }, [lastMessage, isOpen, queryClient]);

  // Load initial alerts
  useEffect(() => {
    if (alertsData?.alerts) {
      const urgentCount = alertsData.alerts.filter(alert => alert.severity === 'urgent').length;
      setUrgentAlerts(urgentCount);

      if (isOpen && messages.length === 0) {
        setMessages(alertsData.alerts);
      }
    }
  }, [alertsData, isOpen, messages.length]);

  const sendMessage = async () => {
    if (!input.trim() || chatMutation.isPending) return;

    const messageContent = input.trim();
    const userMessage: AIMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: messageContent,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      chatMutation.mutate(messageContent);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Add error message to chat
      const errorMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error while processing your message. Please try again.',
        timestamp: new Date(),
        severity: 'warning'
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setUrgentAlerts(0);
    // Force re-fetch of alerts to get fresh data
    queryClient.invalidateQueries({ queryKey: ["/api/ai/alerts"] });
  };

  const getRiskLevelColor = (level?: string) => {
    switch (level) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      default: return 'text-green-500';
    }
  };

  const getMessageSeverityClass = (severity?: string) => {
    switch (severity) {
      case 'urgent': return 'border-red-500';
      case 'warning': return 'border-yellow-500';
      case 'success': return 'border-green-500';
      default: return 'border-jade-500';
    }
  };

  return (
    <>
      {/* Floating AI Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          setIsOpen(true);
          setUrgentAlerts(0);
        }}
        className={`
          fixed bottom-6 right-6 w-16 h-16 rounded-full
          bg-gradient-to-br from-jade-500 to-jade-600
          text-white shadow-2xl flex items-center justify-center
          hover:from-jade-400 hover:to-jade-500 transition-all
          ${!isOpen ? 'block' : 'hidden'}
        `}
        style={{ zIndex: 1000 }}
      >
        <Brain className="w-8 h-8" />
        {urgentAlerts > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold"
          >
            {urgentAlerts}
          </motion.div>
        )}
      </motion.button>

      {/* AI Assistant Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="fixed right-0 top-0 h-full w-[480px] bg-gray-900 border-l border-gray-800 shadow-2xl z-50"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-jade-600 to-jade-500 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Brain className="w-8 h-8" />
                  <div>
                    <h2 className="text-xl font-bold">AI Assistant</h2>
                    <p className="text-jade-100 text-sm">Your Production Copilot</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {messages.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearConversation}
                      className="p-2 hover:bg-jade-700 rounded-lg transition-colors text-white"
                      title="Clear conversation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-jade-700 rounded-lg transition-colors text-white"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-jade-700/50 rounded-lg p-3 text-center">
                  <BarChart3 className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-2xl font-bold">{analysis?.onTimePercentage || 0}%</p>
                  <p className="text-xs">On Time</p>
                </div>
                <div className="bg-jade-700/50 rounded-lg p-3 text-center">
                  <Clock className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-2xl font-bold">{analysis?.totalHours || 0}h</p>
                  <p className="text-xs">Workload</p>
                </div>
                <div className="bg-jade-700/50 rounded-lg p-3 text-center">
                  <AlertTriangle className="w-5 h-5 mx-auto mb-1" />
                  <p className={`text-2xl font-bold uppercase ${getRiskLevelColor(analysis?.riskLevel)}`}>
                    {analysis?.riskLevel || 'LOW'}
                  </p>
                  <p className="text-xs">Risk</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 h-[calc(100%-320px)]">
              <AnimatePresence>
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-8">
                    <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm mb-4">Welcome! I'm here to help with your production management.</p>
                    <div className="text-xs text-left space-y-2">
                      <p>Try asking me about:</p>
                      <ul className="list-disc list-inside space-y-1 text-gray-400">
                        <li>Current workload status</li>
                        <li>Order priorities and deadlines</li>
                        <li>Material tracking</li>
                        <li>Workflow recommendations</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className={`mb-4 ${message.type === 'user' ? 'text-right' : ''}`}
                    >
                      <div
                        className={`
                          inline-block max-w-[80%] p-4 rounded-lg
                          ${message.type === 'user' 
                            ? 'bg-jade-600 text-white' 
                            : message.type === 'alert'
                            ? `bg-gray-800 border-l-4 ${getMessageSeverityClass(message.severity)}`
                            : 'bg-gray-800 text-gray-200'
                          }
                        `}
                      >
                        {message.type === 'assistant' && (
                          <div className="flex items-center gap-2 mb-2 text-jade-400">
                            <Brain className="w-4 h-4" />
                            <span className="text-sm font-semibold">AI Assistant</span>
                          </div>
                        )}
                        <p className="whitespace-pre-line">{message.content}</p>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-6 border-t border-gray-800">
              <div className="flex gap-3">
                <Input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Try: 'Find orders for John Smith' or 'Send update to customer about order ready'"
                  className="flex-1 bg-gray-800 text-white border-gray-700 focus:border-jade-500"
                  disabled={chatMutation.isPending}
                />
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    sendMessage();
                  }}
                  disabled={chatMutation.isPending || !input.trim()}
                  className="bg-jade-500 text-white hover:bg-jade-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
