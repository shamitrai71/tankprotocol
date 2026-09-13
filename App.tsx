import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, Hotel, Utensils, Compass, ChevronRight, Menu, X, User, Globe, MessageSquare, Info, LogOut, CloudSun, Wind, Zap, Navigation, Loader2, Filter, DollarSign, Activity, Settings, Save, CheckCircle2, LayoutGrid, Map as MapIcon, Clock, Calendar, Plus, Trash2, Heart, Award, Sparkles, Shield } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import axios from 'axios';
import { Map, Marker } from 'pigeon-maps';
import { GoogleGenAI, Type } from "@google/genai";
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';
import { AdminPanel } from './AdminPanel';

// Admin email whitelist — add your Gmail here
const ADMIN_EMAILS = ['esraigroup@gmail.com'];
const isAdminUser = (email?: string | null) => !!email && ADMIN_EMAILS.includes(email.toLowerCase());

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// --- Components ---

const DestinationPage = ({ destination, onClose, onPlanTrip }: { destination: any, onClose: () => void, onPlanTrip: (dest: any) => void }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [attractions, setAttractions] = useState<any[]>([]);
  const [hotels, setHotels] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [details, setDetails] = useState<any>(null);
  const [viewAllCategory, setViewAllCategory] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const PlaceCard = ({ place }: { place: any, key?: any }) => (
    <motion.div 
      key={place.place_id} 
      whileHover={{ scale: 1.01, borderColor: '#3ab4ac' }}
      className="bg-white p-6 rounded-[2.5rem] border-2 border-brand-teal/5 flex gap-5 transition-all shadow-lg group"
    >
      <div className="w-14 h-14 bg-brand-coral/10 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
        <Zap className="w-6 h-6 text-brand-coral" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4 mb-1">
          <p className="text-lg font-black text-brand-ink truncate">{place.name}</p>
          <span className="text-[10px] font-black text-brand-yellow whitespace-nowrap bg-brand-yellow/10 px-2 py-0.5 rounded-full">★ {place.rating || 'N/A'}</span>
        </div>
        <p className="text-[10px] font-bold text-gray-400 mb-2 tracking-tight truncate uppercase tracking-widest">{place.vicinity}</p>
        
        {place.details?.editorial_summary?.overview && (
          <p className="text-[10px] text-gray-500 leading-relaxed italic mb-3 p-3 bg-brand-bg rounded-xl border-l-4 border-brand-teal line-clamp-2">
            {place.details.editorial_summary.overview}
          </p>
        )}

        <div className="flex items-center gap-3">
          <div className={`px-3 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${place.opening_hours?.open_now ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
            {place.opening_hours?.open_now ? 'Open Now' : 'Closed'}
          </div>
        </div>
      </div>
    </motion.div>
  );

  const DiscoveryBlock = ({ title, icon: Icon, items, category }: { title: string, icon: any, items: any[], category: string }) => (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b-4 border-brand-teal/10 pb-4">
        <div className="flex items-center gap-3">
          <Icon className="w-8 h-8 text-brand-coral" />
          <h3 className="text-3xl font-black text-brand-ink uppercase tracking-tighter">{title}</h3>
        </div>
        <motion.button 
          whileHover={{ x: 5, color: '#ff6b6b' }}
          onClick={() => setViewAllCategory(category)}
          className="text-xs font-black text-brand-teal uppercase tracking-widest flex items-center gap-1"
        >
          See All <ChevronRight className="w-4 h-4" />
        </motion.button>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {items.slice(0, 5).map((place) => (
          <PlaceCard key={place.place_id} place={place} />
        ))}
        {items.length === 0 && (
          <div className="p-8 bg-brand-bg rounded-3xl border-2 border-dashed border-gray-200 text-center font-bold text-gray-400 uppercase text-xs tracking-widest">
            Scanning for {title.toLowerCase()}...
          </div>
        )}
      </div>
    </div>
  );

  const [aiSummary, setAiSummary] = useState<string>("");

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        let coords = { lat: 0, lon: 0 };

        // Fetch Weather and AQI
        try {
          const weatherRes = await axios.get(`/api/weather?city=${destination.name.split(',')[0]}`);
          setData(weatherRes.data);
          coords = weatherRes.data.coords;
        } catch (weatherErr: any) {
          console.error('Weather fetch failed:', weatherErr.response?.data?.message || weatherErr.message);
          if (destination.coords) {
            coords = { lat: destination.coords[0], lon: destination.coords[1] };
          }
        }

        const { lat, lon } = coords;

        // Parallel fetch for Google data
        const promises: Promise<any>[] = [];

        // Google Details
        if (destination.placeId) {
          promises.push(
            axios.get(`/api/places?placeId=${destination.placeId}`)
              .then(res => setDetails(res.data.result))
              .catch(e => console.error('Place details fetch failed', e))
          );
        }

        // Discovery Items
        if (lat !== 0 || lon !== 0) {
          promises.push(
            Promise.all([
              axios.get(`/api/places?lat=${lat}&lon=${lon}&type=tourist_attraction`),
              axios.get(`/api/places?lat=${lat}&lon=${lon}&type=lodging`),
              axios.get(`/api/places?lat=${lat}&lon=${lon}&type=restaurant`),
              axios.get(`/api/places?lat=${lat}&lon=${lon}&type=museum`)
            ]).then(([attRes, hotelRes, restRes, actRes]) => {
              setAttractions(attRes.data.results || []);
              setHotels(hotelRes.data.results || []);
              setRestaurants(restRes.data.results || []);
              setActivities(actRes.data.results || []);
            }).catch(e => console.error("Places API nearby search failed:", e))
          );
        }

        // Generate AI Short Description
        const fetchAiSummary = async () => {
          try {
            const prompt = `Write a cinematic, 2-sentence summary of the vibe and secret charm of ${destination.name}. Keep it engaging and poetic.`;
            const response = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: prompt,
            });
            setAiSummary(response.text || "");
          } catch (err) {
            console.error("AI Summary generation failed:", err);
          }
        };

        promises.push(fetchAiSummary());

        await Promise.allSettled(promises);

      } catch (error) {
        console.error('Failed to fetch destination data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [destination]);

  const getAQIDescription = (index: number) => {
    const descriptions = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
    return descriptions[index - 1] || 'Unknown';
  };

  const getAQIColor = (index: number) => {
    const colors = ['text-green-500', 'text-yellow-500', 'text-orange-500', 'text-red-500', 'text-purple-500'];
    return colors[index - 1] || 'text-gray-400';
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] bg-brand-bg flex flex-col md:flex-row overflow-hidden"
    >
      {/* Left Column: Visuals & Core Info */}
      <div className="w-full md:w-1/2 lg:w-2/5 relative h-[40vh] md:h-full group">
        <img src={destination.image} alt={destination.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-ink/80 via-brand-ink/20 to-transparent"></div>
        <motion.button 
          onClick={onClose} 
          whileHover={{ scale: 1.1, x: -5 }}
          whileTap={{ scale: 0.9 }}
          className="absolute top-8 left-8 p-4 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-brand-coral transition-all z-20"
        >
          <ChevronRight className="w-8 h-8 rotate-180" />
        </motion.button>
        
        <div className="absolute bottom-12 left-12 right-12 z-10">
          <div className="flex gap-2 mb-4">
            <span className="px-4 py-1.5 bg-brand-yellow rounded-full text-brand-ink text-[10px] font-black uppercase tracking-widest leading-none">
              {destination.tag}
            </span>
            <span className="px-4 py-1.5 bg-brand-teal rounded-full text-white text-[10px] font-black uppercase tracking-widest leading-none">
              {destination.country}
            </span>
          </div>
          <h2 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter leading-none mb-4">
            {destination.name.split(',')[0]}
          </h2>
          <div className="flex items-center gap-4 text-white/60">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              <span className="font-bold text-sm tracking-tight">{destination.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Insights & Details */}
      <div className="flex-1 overflow-y-auto bg-brand-bg no-scrollbar p-8 md:p-16">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-8">
            <div className="relative">
              <motion.div 
                animate={{ scale: [1, 1.2, 1], rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-24 h-24 border-4 border-brand-teal/20 border-t-brand-teal rounded-full shadow-2xl"
              />
              <Compass className="w-8 h-8 text-brand-coral absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-black text-brand-ink uppercase tracking-tighter text-2xl mb-2">Mapping Insights</p>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Collecting weather, air quality, and local stories...</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-16">
            {/* Live Stats Header */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] border-4 border-brand-teal/5 shadow-xl">
                <div className="w-12 h-12 bg-brand-yellow/10 rounded-2xl flex items-center justify-center mb-4">
                  <CloudSun className="w-6 h-6 text-brand-yellow" />
                </div>
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Weather</p>
                {data ? (
                  <>
                    <p className="text-3xl font-black text-brand-ink">{data?.weather?.main?.temp}°C</p>
                    <p className="text-xs font-bold text-gray-500 capitalize italic">{data?.weather?.weather[0]?.description}</p>
                  </>
                ) : (
                  <p className="text-xs font-bold text-brand-coral uppercase tracking-widest leading-tight">Key Inactive<br/>Check Settings</p>
                )}
              </div>
              <div className="bg-white p-8 rounded-[2.5rem] border-4 border-brand-teal/5 shadow-xl">
                <div className="w-12 h-12 bg-brand-green/10 rounded-2xl flex items-center justify-center mb-4">
                  <Wind className="w-6 h-6 text-brand-green" />
                </div>
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Air Quality</p>
                {data ? (
                  <>
                    <p className={`text-3xl font-black ${getAQIColor(data?.aqi?.main?.aqi)}`}>{getAQIDescription(data?.aqi?.main?.aqi)}</p>
                    <p className="text-xs font-bold text-gray-400 italic font-mono leading-none">Index: {data?.aqi?.main?.aqi || 'N/A'}</p>
                  </>
                ) : (
                  <p className="text-xs font-bold text-gray-400 italic leading-tight">Data paused<br/>Setup required</p>
                )}
              </div>
                <div className="bg-white p-8 rounded-[2.5rem] border-4 border-brand-teal/5 shadow-xl col-span-2 md:col-span-1 flex flex-col justify-between">
                  <div>
                    <div className="w-12 h-12 bg-brand-coral/10 rounded-2xl flex items-center justify-center mb-4">
                      <DollarSign className="w-6 h-6 text-brand-coral" />
                    </div>
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Budget</p>
                    <p className="text-3xl font-black text-brand-ink flex items-center gap-1">
                      {destination.price.split(' ')[1]}
                      <span className="text-xs font-black text-brand-coral uppercase tracking-tighter">Budget</span>
                    </p>
                    <p className="text-xs font-bold text-gray-400 italic capitalize">{destination.budget} class travel</p>
                  </div>
                  <motion.button 
                    onClick={() => onPlanTrip(destination)}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    className="mt-6 w-full py-3 bg-brand-ink text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg flex items-center justify-center gap-2"
                  >
                    <Calendar className="w-4 h-4 text-brand-coral" />
                    Plan This Trip
                  </motion.button>
                </div>
            </div>

            {/* AI Destination Intelligence */}
            {aiSummary && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b-4 border-brand-teal/10 pb-4">
                  <Sparkles className="w-8 h-8 text-brand-coral" />
                  <h3 className="text-3xl font-black text-brand-ink uppercase tracking-tighter">AI Destination Overview</h3>
                </div>
                
                <div className="bg-brand-ink text-white rounded-[3rem] p-10 gap-8 flex flex-col md:flex-row items-center shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                    <Sparkles className="w-48 h-48 text-brand-coral" />
                  </div>
                  
                  <div className="flex-1 space-y-6 relative z-10">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="px-3 py-1 bg-brand-coral rounded-full text-[10px] font-black uppercase tracking-widest">Gemini Powered</span>
                      </div>
                      <p className="text-xl md:text-2xl font-black leading-tight tracking-tight">
                        {aiSummary}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Google Places Integration: Specific Details */}
            {details && (
              <div className="space-y-8 mt-12">
                <div className="flex items-center gap-3 border-b-4 border-brand-teal/10 pb-4">
                  <Info className="w-8 h-8 text-brand-coral" />
                  <h3 className="text-3xl font-black text-brand-ink uppercase tracking-tighter">About Destination</h3>
                </div>
                
                <div className="bg-white rounded-[3rem] p-10 border-4 border-brand-teal gap-8 flex flex-col md:flex-row items-start shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Globe className="w-32 h-32 text-brand-teal" />
                  </div>
                  
                  <div className="flex-1 space-y-6 relative z-10">
                    <div>
                      <h4 className="text-2xl font-black text-brand-ink mb-2">Google Verified Intelligence</h4>
                      <p className="text-gray-500 leading-relaxed font-bold italic">
                        {details.editorial_summary?.overview || "Explore the unique character and cultural identity of this extraordinary destination through our verified intelligence portal."}
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {details.website && (
                        <motion.a 
                          href={details.website} 
                          target="_blank" 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center gap-3 p-4 bg-brand-bg rounded-2xl border-2 border-brand-teal/10 hover:border-brand-teal transition-all"
                        >
                          <Globe className="w-5 h-5 text-brand-teal" />
                          <span className="text-xs font-black uppercase tracking-widest">Official Website</span>
                        </motion.a>
                      )}
                      {details.formatted_phone_number && (
                        <div className="flex items-center gap-3 p-4 bg-brand-bg rounded-2xl border-2 border-brand-teal/10">
                          <MessageSquare className="w-5 h-5 text-brand-teal" />
                          <span className="text-xs font-black uppercase tracking-widest">{details.formatted_phone_number}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* User Reviews Section */}
                {details.reviews && details.reviews.length > 0 && (
                  <div className="space-y-8 mt-16">
                    <div className="flex items-center justify-between border-b-4 border-brand-teal/10 pb-4">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="w-8 h-8 text-brand-coral" />
                        <h3 className="text-3xl font-black text-brand-ink uppercase tracking-tighter">Traveler Stories</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-brand-teal uppercase tracking-widest bg-brand-teal/5 px-3 py-1 rounded-full">
                          {details.reviews.length} Verified Reviews
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {details.reviews.map((review: any, i: number) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          viewport={{ once: true }}
                          className="bg-white p-8 rounded-[2.5rem] border-2 border-brand-teal/10 shadow-xl hover:shadow-2xl transition-all group flex flex-col justify-between"
                        >
                          <div className="relative">
                            <span className="text-6xl text-brand-teal opacity-10 absolute -top-6 -left-4 font-serif">"</span>
                            <p className="text-gray-600 leading-relaxed font-medium line-clamp-4 relative z-10">
                              {review.text}
                            </p>
                          </div>
                          
                          <div className="mt-8 pt-6 border-t-2 border-brand-bg flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {review.profile_photo_url ? (
                                <img 
                                  src={review.profile_photo_url} 
                                  alt={review.author_name} 
                                  className="w-10 h-10 rounded-full border-2 border-brand-teal/20"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center font-black text-brand-teal text-xs">
                                  {review.author_name.charAt(0)}
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-black text-brand-ink uppercase tracking-tight">{review.author_name}</p>
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{review.relative_time_description}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <div className="flex items-center gap-0.5 mb-1">
                                {[...Array(5)].map((_, starIdx) => (
                                  <span key={starIdx} className={`text-[10px] ${starIdx < review.rating ? 'text-brand-yellow' : 'text-gray-200'}`}>★</span>
                                ))}
                              </div>
                              <span className="text-[10px] font-black text-brand-ink">{review.rating}.0</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Discovery Sections */}
            <div className="space-y-24">
              <DiscoveryBlock title="Extraordinary Hotels" icon={Hotel} items={hotels} category="lodging" />
              <DiscoveryBlock title="Top Restaurants" icon={Utensils} items={restaurants} category="restaurant" />
              <DiscoveryBlock title="Wow Attractions" icon={Compass} items={attractions} category="tourist_attraction" />
              <DiscoveryBlock title="Great Activities" icon={Activity} items={activities} category="museum" />
            </div>
          </div>
        )}
      </div>

      {/* Tiled Grid Overlay */}
      <AnimatePresence>
        {viewAllCategory && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-[150] bg-brand-bg flex flex-col"
          >
            <div className="p-8 flex items-center justify-between border-b-4 border-brand-teal/10">
              <div>
                <h3 className="text-4xl font-black text-brand-ink uppercase tracking-tighter">
                  {viewAllCategory === 'lodging' ? 'Extraordinary Hotels' : 
                   viewAllCategory === 'restaurant' ? 'Culinary Landmarks' : 
                   viewAllCategory === 'tourist_attraction' ? 'Wow Attractions' :
                   'Great Activities'}
                </h3>
                <p className="text-brand-coral font-black uppercase text-xs tracking-[0.2em]">Curated findings in {destination.name.split(',')[0]}</p>
              </div>
              <motion.button 
                onClick={() => setViewAllCategory(null)}
                whileHover={{ rotate: 90, scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-4 bg-white border-4 border-brand-teal/10 rounded-full hover:bg-brand-coral hover:text-white transition-all shadow-lg"
              >
                <X className="w-8 h-8" />
              </motion.button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 md:p-12 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {(viewAllCategory === 'lodging' ? hotels : 
                  viewAllCategory === 'restaurant' ? restaurants : 
                  viewAllCategory === 'tourist_attraction' ? attractions :
                  activities).map((place) => (
                  <motion.div 
                    key={place.place_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[3rem] overflow-hidden shadow-2xl border-4 border-brand-teal/5 flex flex-col group hover:border-brand-teal transition-all"
                  >
                    <div className="p-8 space-y-6 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-brand-bg rounded-2xl flex items-center justify-center">
                            {viewAllCategory === 'lodging' ? <Hotel className="w-6 h-6 text-brand-teal" /> :
                             viewAllCategory === 'restaurant' ? <Utensils className="w-6 h-6 text-brand-coral" /> :
                             viewAllCategory === 'tourist_attraction' ? <Compass className="w-6 h-6 text-brand-green" /> :
                             <Activity className="w-6 h-6 text-brand-yellow" />}
                          </div>
                          <span className="text-sm font-black text-brand-yellow">★ {place.rating || 'N/A'}</span>
                        </div>
                        <h4 className="text-2xl font-black text-brand-ink mb-2 leading-tight">{place.name}</h4>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest truncate">{place.vicinity}</p>
                      </div>

                      <div className="pt-6 flex items-center justify-between border-t border-gray-100">
                        <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${place.opening_hours?.open_now ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {place.opening_hours?.open_now ? 'Open Now' : 'Currently Closed'}
                        </div>
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          className="p-2 bg-brand-bg rounded-xl text-brand-teal"
                        >
                          <Info className="w-5 h-5" />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ProfileSettings = ({ onClose }: { onClose: () => void }) => {
  const { userProfile, updateProfile } = useAuth();
  const [formData, setFormData] = useState({
    displayName: userProfile?.displayName || '',
    homeBase: userProfile?.homeBase || '',
    travelStyle: userProfile?.travelStyle || 'Explorer',
    bio: userProfile?.bio || '',
    dreamDestinations: userProfile?.dreamDestinations || '',
    interests: userProfile?.interests || '',
    budget: userProfile?.budget || 'economy',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile(formData);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-brand-bg w-full max-w-xl rounded-[3rem] overflow-hidden shadow-2xl border-4 border-brand-teal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-brand-ink uppercase tracking-tight">Edit Profile</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mb-2 block ml-2">Display Name</label>
              <input 
                type="text" 
                className="w-full bg-white p-4 rounded-2xl border-2 border-brand-teal/10 focus:border-brand-teal outline-none font-bold transition-all"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mb-2 block ml-2">Bio / Travel Philosophy</label>
              <textarea 
                className="w-full bg-white p-4 rounded-2xl border-2 border-brand-teal/10 focus:border-brand-teal outline-none font-bold transition-all min-h-[100px] resize-none"
                placeholder="What drives your travels?"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mb-2 block ml-2">Travel Style</label>
                <select 
                  className="w-full bg-white p-4 rounded-2xl border-2 border-brand-teal/10 focus:border-brand-teal outline-none font-bold transition-all appearance-none cursor-pointer"
                  value={formData.travelStyle}
                  onChange={(e) => setFormData({ ...formData, travelStyle: e.target.value })}
                >
                  <option value="Adventure">Adventure Seeker</option>
                  <option value="Culture">Culture Enthusiast</option>
                  <option value="Romance">Romantic Voyager</option>
                  <option value="Elegance">Elegant Traveler</option>
                  <option value="Explorer">General Explorer</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mb-2 block ml-2">Typical Budget</label>
                <select 
                  className="w-full bg-white p-4 rounded-2xl border-2 border-brand-teal/10 focus:border-brand-teal outline-none font-bold transition-all appearance-none cursor-pointer"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                >
                  <option value="economy">Economy / Budget</option>
                  <option value="premium">Premium / Mid-Range</option>
                  <option value="luxury">Luxury / High-End</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mb-2 block ml-2">Home Base</label>
              <input 
                type="text" 
                placeholder="City, Country"
                className="w-full bg-white p-4 rounded-2xl border-2 border-brand-teal/10 focus:border-brand-teal outline-none font-bold transition-all"
                value={formData.homeBase}
                onChange={(e) => setFormData({ ...formData, homeBase: e.target.value })}
              />
            </div>
            
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mb-2 block ml-2">Dream Destinations (Comma separated)</label>
              <input 
                type="text" 
                placeholder="Tokyo, Iceland, Patagonia..."
                className="w-full bg-white p-4 rounded-2xl border-2 border-brand-teal/10 focus:border-brand-teal outline-none font-bold transition-all"
                value={formData.dreamDestinations}
                onChange={(e) => setFormData({ ...formData, dreamDestinations: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mb-2 block ml-2">Interests (e.g. Hiking, Food, Art)</label>
              <input 
                type="text" 
                placeholder="Photography, Surfing, History..."
                className="w-full bg-white p-4 rounded-2xl border-2 border-brand-teal/10 focus:border-brand-teal outline-none font-bold transition-all"
                value={formData.interests}
                onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
              />
            </div>

            <div className="pt-6">
              <button 
                type="submit"
                disabled={isSaving}
                className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                  isSaving ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-brand-coral text-white shadow-[0_6px_0_0_#d15252] active:translate-y-1 active:shadow-none'
                }`}
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {isSaving ? 'Synchronizing...' : 'Save Settings'}
              </button>
            </div>
          </form>

          <AnimatePresence>
            {showSuccess && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-6 flex items-center justify-center gap-2 text-brand-green font-bold text-sm bg-brand-green/10 py-3 rounded-xl border border-brand-green/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                Profile updated across all cloud nodes.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

const TripPlanner = ({ onClose, initialDestination, destinations }: { onClose: () => void, initialDestination?: any, destinations: any[] }) => {
  const { user, userProfile } = useAuth();
  const [itinerary, setItinerary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingSuggestions, setFetchingSuggestions] = useState(false);
  const [suggestedActivities, setSuggestedActivities] = useState<any[]>([]);
  const [suggestedHotels, setSuggestedHotels] = useState<any[]>([]);
  const [newDay, setNewDay] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    activity: '', 
    notes: '',
    destination: initialDestination?.name || destinations[0]?.name || ''
  });

  const currentDest = useMemo(() => {
    return destinations.find(d => d.name === newDay.destination);
  }, [newDay.destination, destinations]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!currentDest || !currentDest.coords) return;
      setFetchingSuggestions(true);
      try {
        const [lat, lon] = currentDest.coords;
        const style = userProfile?.travelStyle || 'Explorer';
        const budget = userProfile?.budget || 'economy';

        // Budget mapping for Google Places (0-4)
        const budgetMap: { [key: string]: { min: number, max: number } } = {
          economy: { min: 0, max: 1 },
          premium: { min: 2, max: 3 },
          luxury: { min: 4, max: 4 }
        };
        const { min, max } = budgetMap[budget.toLowerCase()] || { min: 0, max: 2 };

        // Style mapping for activity types
        const styleToType: { [key: string]: string } = {
          Adventure: 'park',
          Culture: 'museum',
          Romance: 'restaurant',
          Elegance: 'night_club'
        };
        const activityType = styleToType[style] || 'tourist_attraction';

        // Fetch Activities
        const actRes = await axios.get(`/api/places?lat=${lat}&lon=${lon}&type=${activityType}&keyword=${style}&minprice=${min}&maxprice=${max}`);
        setSuggestedActivities(actRes.data.results || []);

        // Fetch Accommodations
        const hotelRes = await axios.get(`/api/places?lat=${lat}&lon=${lon}&type=lodging&minprice=${min}&maxprice=${max}`);
        setSuggestedHotels(hotelRes.data.results || []);

      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setFetchingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [newDay.destination, currentDest, userProfile]);

  useEffect(() => {
    const fetchItinerary = async () => {
      const saved = localStorage.getItem(`itinerary_${user?.uid}`);
      if (saved) setItinerary(JSON.parse(saved));
      setLoading(false);
    };
    fetchItinerary();
  }, [user]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const addDay = () => {
    if (!newDay.date || !newDay.activity || !newDay.destination) return;
    const updated = [...itinerary, { ...newDay, id: Date.now() }].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setItinerary(updated);
    localStorage.setItem(`itinerary_${user?.uid}`, JSON.stringify(updated));
    setNewDay({ 
      ...newDay,
      activity: '', 
      notes: '' 
    });
  };

  const removeDay = (id: number) => {
    const updated = itinerary.filter(day => day.id !== id);
    setItinerary(updated);
    localStorage.setItem(`itinerary_${user?.uid}`, JSON.stringify(updated));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-brand-ink/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-brand-bg w-full max-w-4xl max-h-[90vh] rounded-[4rem] overflow-hidden shadow-2xl border-8 border-brand-teal flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-12 overflow-y-auto no-scrollbar">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-5xl font-black text-brand-ink uppercase tracking-tighter leading-none mb-2">Trip Architect</h2>
              <p className="font-bold text-gray-400 uppercase tracking-widest text-xs">Drafting your extraordinary journey</p>
            </div>
            <motion.button 
              onClick={onClose} 
              whileHover={{ rotate: 90, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-4 bg-white border-4 border-brand-teal/10 rounded-full hover:bg-brand-coral hover:text-white transition-all shadow-lg group"
            >
              <X className="w-8 h-8 group-active:scale-90" />
            </motion.button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Form Section */}
            <div className="lg:col-span-5 bg-white p-8 rounded-[3rem] border-4 border-brand-teal/5 shadow-xl h-fit">
              <h3 className="text-xl font-black text-brand-ink mb-6 flex items-center gap-2 uppercase tracking-tight">
                <Plus className="w-6 h-6 text-brand-coral" /> Add a Chapter
              </h3>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block ml-2">Destination</label>
                  <select 
                    className="w-full bg-brand-bg p-4 rounded-2xl border-2 border-brand-teal/10 focus:border-brand-teal outline-none font-bold transition-all appearance-none"
                    value={newDay.destination}
                    onChange={(e) => setNewDay({ ...newDay, destination: e.target.value })}
                  >
                    {destinations.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block ml-2">Date</label>
                  <input 
                    type="date" 
                    className="w-full bg-brand-bg p-4 rounded-2xl border-2 border-brand-teal/10 focus:border-brand-teal outline-none font-bold transition-all"
                    value={newDay.date}
                    onChange={(e) => setNewDay({ ...newDay, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block ml-2">Main Attraction / Activity</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Louvre Museum Visit"
                    className="w-full bg-brand-bg p-4 rounded-2xl border-2 border-brand-teal/10 focus:border-brand-teal outline-none font-bold transition-all"
                    value={newDay.activity}
                    onChange={(e) => setNewDay({ ...newDay, activity: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block ml-2">Field Notes</label>
                  <textarea 
                    placeholder="Specific locations, restaurant names, or vibe check..."
                    className="w-full bg-brand-bg p-4 rounded-2xl border-2 border-brand-teal/10 focus:border-brand-teal outline-none font-bold transition-all h-24 resize-none"
                    value={newDay.notes}
                    onChange={(e) => setNewDay({ ...newDay, notes: e.target.value })}
                  />
                </div>
                <motion.button 
                  onClick={addDay}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-5 bg-brand-teal text-white rounded-2xl font-black uppercase tracking-widest shadow-[0_6px_0_0_#3ab4ac] active:shadow-none transition-all flex items-center justify-center gap-2"
                >
                  Confirm Entry
                </motion.button>
              </div>
            </div>

            {/* List Section */}
            <div className="lg:col-span-7 space-y-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-brand-ink flex items-center gap-2 uppercase tracking-tight">
                  <Calendar className="w-6 h-6 text-brand-coral" /> Itinerary Timeline
                </h3>
              </div>
              
              {/* Smart Recommendations Section */}
              <div className="bg-white p-8 rounded-[3rem] border-4 border-brand-teal/5 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-lg font-black text-brand-ink uppercase tracking-tight">Vault Recommendations</h4>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Tailored to your {userProfile?.travelStyle || 'Explorer'} style</p>
                  </div>
                  {fetchingSuggestions ? (
                    <Loader2 className="w-5 h-5 text-brand-teal animate-spin" />
                  ) : (
                    <Zap className="w-5 h-5 text-brand-yellow" />
                  )}
                </div>

                <div className="space-y-6">
                  {/* Suggested Activities */}
                  <div>
                    <p className="text-[10px] font-black uppercase text-brand-coral tracking-widest mb-3 px-2 flex items-center gap-2">
                      <Compass className="w-3 h-3" /> Suggested Activities
                    </p>
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                      {suggestedActivities.length > 0 ? (
                        suggestedActivities.map((place) => (
                          <motion.button
                            key={place.place_id}
                            whileHover={{ y: -4, scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setNewDay({ ...newDay, activity: place.name, notes: `Rating: ${place.rating} | ${place.vicinity}` })}
                            className="flex-shrink-0 w-48 bg-brand-bg p-4 rounded-2xl border-2 border-brand-teal/5 hover:border-brand-teal transition-all text-left group"
                          >
                            <p className="font-black text-xs text-brand-ink truncate mb-1 group-hover:text-brand-teal transition-colors">{place.name}</p>
                            <p className="text-[8px] font-bold text-gray-400 truncate uppercase tracking-widest">{place.vicinity}</p>
                            <div className="flex items-center gap-1 mt-2">
                              <span className="text-[8px] font-black text-brand-yellow">★ {place.rating || 'N/A'}</span>
                            </div>
                          </motion.button>
                        ))
                      ) : (
                        <p className="text-[10px] font-bold text-gray-400 italic px-2">No activity matches found for this vault profile...</p>
                      )}
                    </div>
                  </div>

                  {/* Suggested Accommodations */}
                  <div>
                    <p className="text-[10px] font-black uppercase text-brand-teal tracking-widest mb-3 px-2 flex items-center gap-2">
                      <Hotel className="w-3 h-3" /> Booking Concepts
                    </p>
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                      {suggestedHotels.length > 0 ? (
                        suggestedHotels.map((place) => (
                          <motion.button
                            key={place.place_id}
                            whileHover={{ y: -4, scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`, '_blank')}
                            className="flex-shrink-0 w-48 bg-brand-bg p-4 rounded-2xl border-2 border-brand-teal/5 hover:border-brand-teal transition-all text-left group"
                          >
                            <p className="font-black text-xs text-brand-ink truncate mb-1 group-hover:text-brand-teal transition-colors">{place.name}</p>
                            <p className="text-[8px] font-bold text-gray-400 truncate uppercase tracking-widest">{place.vicinity}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[8px] font-black text-brand-yellow">★ {place.rating || 'N/A'}</span>
                              <span className="text-[8px] font-black text-brand-teal uppercase tracking-widest">Book</span>
                            </div>
                          </motion.button>
                        ))
                      ) : (
                        <p className="text-[10px] font-bold text-gray-400 italic px-2">Scanning for accommodations fitting your budget...</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[3rem] border-4 border-brand-teal/5 shadow-xl">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Clock className="w-16 h-16 text-brand-teal mb-6 opacity-30" />
                  </motion.div>
                  <p className="text-xl font-black text-brand-ink uppercase tracking-tighter">Drafting Timeline...</p>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2 px-12 text-center">Retrieving your extraordinary path from history</p>
                </div>
              ) : itinerary.length > 0 ? (
                <div className="space-y-4 pr-4">
                  {itinerary.map((day) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ x: 5, borderColor: '#ff6b6b' }}
                      key={day.id}
                      className="bg-white p-6 rounded-[2.5rem] border-4 border-brand-teal/10 shadow-sm relative group"
                    >
                      <motion.button 
                        onClick={() => removeDay(day.id)}
                        whileHover={{ scale: 1.2, color: '#ff6b6b' }}
                        whileTap={{ scale: 0.8 }}
                        className="absolute top-6 right-6 p-2 text-gray-300 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-5 h-5" />
                      </motion.button>
                      <div className="flex gap-6 items-start">
                        <div className="bg-brand-coral/10 p-4 rounded-2xl text-center min-w-[70px]">
                          <p className="text-[10px] font-black uppercase text-brand-coral tracking-widest">
                            {new Date(day.date).toLocaleDateString('en-US', { month: 'short' })}
                          </p>
                          <p className="text-2xl font-black text-brand-ink">
                            {new Date(day.date).getDate() + 1}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[8px] font-black uppercase bg-brand-ink text-white px-2 py-0.5 rounded-full tracking-widest">{day.destination}</span>
                          </div>
                          <h4 className="text-xl font-black text-brand-ink mb-1">{day.activity}</h4>
                          <p className="text-xs font-bold text-gray-500 leading-relaxed italic">{day.notes || 'No extra notes recorded.'}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="bg-white/50 border-4 border-dashed border-gray-200 rounded-[3rem] p-20 text-center">
                  <Compass className="w-16 h-16 text-gray-200 mx-auto mb-6" />
                  <p className="text-xl font-black text-gray-400 uppercase tracking-tight">Your roadmap is currently blank.</p>
                  <p className="font-bold text-gray-400 mt-2">Start adding chapters to begin your journey.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Navbar = ({ setShowAdminPanel }: { setShowAdminPanel: (show: boolean) => void }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signIn, signOut } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4 ${
        isScrolled ? 'bg-brand-bg/90 backdrop-blur-md shadow-md' : 'bg-transparent'
      }`}
      id="main-nav"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-coral rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-lg">
            A
          </div>
          <span className={`text-2xl font-black tracking-tight ${isScrolled ? 'text-brand-ink' : 'text-white'}`}>
            ABLEDINOS
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {['Destinations', 'Tips', 'About'].map((item) => (
            <motion.a 
              key={item}
              href="#" 
              whileHover={{ y: -2, color: '#ff6b6b' }}
              className={`text-sm font-bold transition-colors ${isScrolled ? 'text-brand-ink' : 'text-white/80'}`}
            >
              {item}
            </motion.a>
          ))}
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`p-2 rounded-full transition-colors ${isScrolled ? 'hover:bg-brand-teal/10 text-brand-ink' : 'hover:bg-white/10 text-white'}`}
          >
            <Search className="w-5 h-5" />
          </motion.button>
          
          {user ? (
            <div className="flex items-center gap-4">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="flex items-center gap-2 cursor-pointer"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full border-2 border-brand-teal shadow-sm" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-brand-teal flex items-center justify-center text-white font-bold">
                    {user.displayName?.[0] || 'U'}
                  </div>
                )}
                <span className={`text-sm font-bold ${isScrolled ? 'text-brand-ink' : 'text-white'}`}>
                  {user.displayName?.split(' ')[0]}
                </span>
              </motion.div>
              <motion.button 
                whileHover={{ scale: 1.1, rotate: 10 }}
                whileTap={{ scale: 0.9 }}
                onClick={signOut}
                className={`p-2 rounded-full transition-colors ${isScrolled ? 'hover:bg-brand-coral/10 text-brand-coral' : 'hover:bg-white/10 text-white'}`}
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </motion.button>
              {isAdminUser(user.email) && (
                <motion.button 
                  whileHover={{ scale: 1.1, rotate: -10 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowAdminPanel(true)}
                  className={`p-2 rounded-full transition-colors ${isScrolled ? 'hover:bg-brand-teal/10 text-brand-teal' : 'hover:bg-white/10 text-white'}`}
                  title="Admin Panel"
                >
                  <Shield className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          ) : (
            <motion.button 
              onClick={signIn}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full transition-all font-bold shadow-[0_4px_0_0_#3ab4ac] active:shadow-none ${
                isScrolled ? 'bg-brand-teal text-white shadow-[#3ab4ac]' : 'bg-white text-brand-teal shadow-gray-200'
              }`}
            >
              <User className="w-4 h-4" />
              <span className="text-sm uppercase tracking-wider">Sign In</span>
            </motion.button>
          )}
        </div>

        <button 
          className="md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? (
            <X className={isScrolled ? 'text-black' : 'text-white'} />
          ) : (
            <Menu className={isScrolled ? 'text-black' : 'text-white'} />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 bg-white shadow-xl p-6 flex flex-col gap-4 md:hidden"
          >
            <a href="#" className="text-lg font-medium text-gray-900 font-display">Destinations</a>
            <a href="#" className="text-lg font-medium text-gray-900 font-display">Tips</a>
            <a href="#" className="text-lg font-medium text-gray-900 font-display">About</a>
            <hr className="border-gray-100" />
            {user ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  {user.photoURL && <img src={user.photoURL} className="w-10 h-10 rounded-full" alt="" />}
                  <span className="font-bold text-brand-ink">{user.displayName}</span>
                </div>
                <button 
                  onClick={() => { signOut(); setIsMenuOpen(false); }}
                  className="flex items-center justify-center gap-3 px-6 py-3 bg-brand-coral text-white rounded-xl font-bold uppercase tracking-widest shadow-[0_4px_0_0_#d15252]"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button 
                onClick={() => { signIn(); setIsMenuOpen(false); }}
                className="flex items-center justify-center gap-3 px-6 py-3 bg-brand-teal text-white rounded-xl font-bold uppercase tracking-widest shadow-[0_4px_0_0_#3ab4ac]"
              >
                <User className="w-5 h-5" />
                Sign In
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = ({ onSearch, destinations }: { onSearch: (searchTerm: string) => void, destinations: any[] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return destinations
      .filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 5);
  }, [searchTerm, destinations]);

  const handleSearch = () => {
    onSearch(searchTerm);
    const section = document.getElementById('search-results-section');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (name: string) => {
    setSearchTerm(name);
    setShowSuggestions(false);
    onSearch(name);
    handleSearch();
  };

  return (
    <section className="relative min-h-screen w-full overflow-hidden flex items-center justify-center text-center px-6 pt-20" id="hero-section">
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=2000" 
          alt="Luxury travel destination"
          className="w-full h-full object-cover brightness-[0.4]"
        />
      </div>
      
      <div className="relative z-10 max-w-5xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-8"
        >
          <div className="inline-block bg-brand-yellow px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest text-[#857200]">
            Explore the Extraordinary
          </div>
          <h1 className="text-5xl md:text-8xl font-black text-white tracking-tight leading-[1.05]">
            Travel smarter, <br />
            <span className="text-brand-coral">explore deeper.</span>
          </h1>
          
          <div className="max-w-3xl mx-auto mt-12 bg-white/10 backdrop-blur-2xl p-2 rounded-[2.5rem] border-4 border-white/20 shadow-2xl">
            <div className="flex flex-col md:flex-row items-stretch gap-2 relative">
              <div className="flex-1 relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/50 w-6 h-6" />
                <input 
                  type="text" 
                  placeholder="Where to next? (e.g. Kyoto, Greece...)"
                  className="w-full bg-white/10 text-white placeholder:text-white/40 py-6 pl-16 pr-6 rounded-[2rem] outline-none font-bold text-lg border-2 border-transparent focus:border-brand-teal transition-all"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    onSearch(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />

                <AnimatePresence>
                  {showSuggestions && suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute left-0 right-0 top-full mt-2 bg-white rounded-3xl shadow-2xl overflow-hidden z-[100] border-4 border-brand-teal/10"
                    >
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleSuggestionClick(s.name)}
                          className="w-full text-left px-8 py-5 hover:bg-brand-bg transition-colors flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-4">
                            <MapPin className="w-5 h-5 text-brand-coral" />
                            <div>
                              <p className="font-black text-brand-ink uppercase tracking-tight">{s.name}</p>
                              <p className="text-[10px] font-bold text-gray-400 tracking-widest">{s.country}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:translate-x-1 group-hover:text-brand-coral transition-all" />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <motion.button 
                onClick={handleSearch}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="px-10 py-5 bg-brand-coral text-white rounded-[2rem] font-black uppercase tracking-widest transition-all shadow-[0_6px_0_0_#d15252] active:translate-y-1 active:shadow-none"
              >
                Search
              </motion.button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-12 pt-12 overflow-x-auto no-scrollbar pb-4">
            {['Kyoto', 'Santorini', 'Berlin', 'Rajasthan', 'Zermatt'].map((pop) => (
              <motion.button 
                key={pop} 
                whileHover={{ scale: 1.1, color: '#ff6b6b' }}
                whileTap={{ scale: 0.9 }}
                className="text-white/60 font-black text-xs uppercase tracking-[0.2em] transition-all whitespace-nowrap"
                onClick={() => { setSearchTerm(pop); onSearch(pop); }}
              >
                # {pop}
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <div className="w-[1px] h-12 bg-gradient-to-b from-white/50 to-transparent"></div>
      </div>
    </section>
  );
};

const Categories = () => {
  const categories = [
    { id: 'cities', name: 'Cities', icon: Globe, count: 124, color: 'bg-brand-yellow text-brand-ink' },
    { id: 'hotels', name: 'Hotels', icon: Hotel, count: 482, color: 'bg-brand-green text-white' },
    { id: 'restaurants', name: 'Restaurants', icon: Utensils, count: 850, color: 'bg-brand-coral text-white' },
    { id: 'attractions', name: 'Attractions', icon: Compass, count: 312, color: 'bg-brand-blue text-white' },
  ];

  return (
    <section className="py-24 bg-brand-bg px-6" id="categories-section">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <h2 className="text-xs font-black text-brand-coral uppercase tracking-[0.2em] mb-4">Discovery</h2>
            <h3 className="text-4xl md:text-6xl font-black text-brand-ink tracking-tight">Explore the favorites</h3>
          </div>
          <p className="text-gray-600 max-w-md font-bold leading-relaxed">
            Hand-picked selections from our travel experts to help you plan your next perfect trip.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat, idx) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.05, rotate: idx % 2 === 0 ? -1 : 1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ delay: idx * 0.1 }}
              viewport={{ once: true }}
              className={`group p-8 ${cat.color} rounded-[2.5rem] shadow-xl transition-all duration-300 cursor-pointer border-b-8 border-black/10`}
            >
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-12 shadow-md group-hover:rotate-12 transition-all">
                <cat.icon className="w-6 h-6 text-brand-ink" />
              </div>
              <h4 className="text-2xl font-black mb-2 uppercase tracking-tight">
                Featured {cat.name}
              </h4>
              <p className="font-bold opacity-80 uppercase text-xs tracking-widest">
                {cat.count} handpicked listings
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const FeaturedDestinations = ({ onInfoClick }: { onInfoClick: (dest: any) => void }) => {
  const destinations = [
    { 
      id: 1, 
      name: 'Santorini, Greece', 
      image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&q=80&w=800',
      tag: 'Romance',
      price: 'From $1,200',
      rating: 4.9
    },
    { 
      id: 2, 
      name: 'Kyoto, Japan', 
      image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&q=80&w=800',
      tag: 'Culture',
      price: 'From $2,400',
      rating: 4.8
    },
    { 
      id: 3, 
      name: 'Amalfi Coast, Italy', 
      image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=800',
      tag: 'Adventure',
      price: 'From $1,800',
      rating: 5.0
    },
    { 
      id: 4, 
      name: 'Paris, France', 
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=800',
      tag: 'Elegance',
      price: 'From $1,500',
      rating: 4.7
    }
  ];

  return (
    <section className="py-24 bg-white px-6" id="featured-destinations">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-12">
          <h3 className="text-4xl font-black tracking-tight text-brand-ink uppercase">Top Destinations</h3>
          <motion.button 
            whileHover={{ x: 8, color: '#ff6b6b' }}
            whileTap={{ scale: 0.95 }}
            className="text-sm font-black text-brand-coral flex items-center gap-1 transition-all uppercase tracking-widest"
          >
            See all <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {destinations.map((dest, idx) => (
            <motion.div
              key={dest.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              viewport={{ once: true }}
              className="group bg-white rounded-[3rem] overflow-hidden shadow-xl border-4 border-brand-teal/20 hover:border-brand-teal transition-all duration-500"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <img 
                  src={dest.image} 
                  alt={dest.name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-6 left-6 flex flex-col gap-2">
                  <span className="px-4 py-1.5 bg-brand-yellow rounded-full text-brand-ink text-[10px] font-black uppercase tracking-widest shadow-md">
                    {dest.tag}
                  </span>
                </div>
                <div className="absolute bottom-6 right-6">
                  <motion.button 
                    onClick={() => onInfoClick(dest)}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-3 bg-brand-bg/80 backdrop-blur-md rounded-2xl border-2 border-brand-teal/20 shadow-xl hover:bg-brand-teal hover:text-white transition-all group/btn"
                  >
                    <Zap className="w-5 h-5 text-brand-coral group-hover/btn:text-white" />
                  </motion.button>
                </div>
              </div>
              <div className="p-8">
                <div className="flex items-center gap-1 mb-2">
                  <MapPin className="w-4 h-4 text-brand-coral" />
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{dest.name.split(', ')[1]}</span>
                </div>
                <h4 className="text-2xl font-black text-brand-ink mb-4 tracking-tight">{dest.name}</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-400 font-black uppercase mb-1">Price Start</p>
                    <p className="font-black text-brand-coral text-lg">{dest.price}</p>
                  </div>
                  <div className="bg-brand-bg px-4 py-2 rounded-2xl border-2 border-brand-teal/10 shadow-sm flex items-center gap-2">
                    <span className="text-sm font-black text-brand-teal">★ {dest.rating}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const TipsSection = () => {
  const tips = [
    { 
      title: "How to avoid tourist traps in Europe", 
      excerpt: "Seasoned wisdom to make every trip seamless, affordable, and unforgettable.",
      author: "Elena Rossi",
      date: "Oct 24, 2025"
    },
    { 
      title: "Packing light for a month in Kyoto", 
      excerpt: "Discover highlights, local character, and practical tips for this destination.",
      author: "Kenji Sato",
      date: "Nov 12, 2025"
    },
    { 
      title: "Hidden restaurants of the Amalfi Coast", 
      excerpt: "Exclusive recommendations from local chefs and residents.",
      author: "Marco Polo",
      date: "Dec 05, 2025"
    }
  ];

  return (
    <section className="py-24 bg-white px-6 border-b border-gray-100" id="tips-section">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Insider Knowledge</h2>
            <h3 className="text-4xl font-bold text-gray-900 tracking-tight mb-6">Tips for Brilliant Journeys</h3>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Our travel writers sift through the noise to bring you the advice that actually matters. From logistical hacks to cultural nuances.
            </p>
            <button className="px-8 py-3 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all">
              View All Guides
            </button>
          </div>
          <div className="lg:col-span-8 flex flex-col gap-12">
            {tips.map((tip, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="group flex flex-col md:flex-row md:items-center justify-between gap-6 pb-12 border-b border-gray-50 last:border-0"
              >
                <div className="max-w-xl">
                  <h4 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors cursor-pointer leading-snug">
                    {tip.title}
                  </h4>
                  <p className="text-gray-500 text-sm leading-relaxed mb-4">{tip.excerpt}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-200 rounded-full"></div>
                      <span className="text-xs font-semibold text-gray-600">{tip.author}</span>
                    </div>
                    <span className="text-xs text-gray-400">{tip.date}</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <button className="p-4 bg-gray-50 rounded-full group-hover:bg-black group-hover:text-white transition-all transform group-hover:rotate-45">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const CountryExplorer = ({ country, destinations, onInfoClick, onClose }: { country: string, destinations: any[], onInfoClick: (dest: any) => void, onClose: () => void }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-brand-ink/95 backdrop-blur-xl flex flex-col"
    >
      <div className="p-8 flex items-center justify-between border-b border-white/10">
        <div>
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-none mb-2">{country}</h2>
          <p className="text-brand-teal font-bold uppercase tracking-widest text-xs">Discovering {destinations.length} local gems</p>
        </div>
        <button 
          onClick={onClose}
          className="p-4 bg-white/10 text-white rounded-full hover:bg-brand-coral transition-all group border border-white/20"
        >
          <X className="w-8 h-8 group-active:scale-95" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
        <div className="max-w-7xl mx-auto">
          {destinations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {destinations.map((dest, idx) => (
                <motion.div
                  key={dest.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="group bg-white rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white/10 hover:border-brand-teal transition-all duration-500"
                >
                  <div className="relative aspect-video">
                    <img src={dest.image} className="w-full h-full object-cover" alt={dest.name} referrerPolicy="no-referrer" />
                    <div className="absolute top-6 left-6 flex gap-2">
                      <span className="px-3 py-1 bg-brand-yellow rounded-full text-[10px] font-black uppercase text-brand-ink">{dest.tag}</span>
                    </div>
                  </div>
                  <div className="p-8">
                    <h4 className="text-2xl font-black text-brand-ink mb-4">{dest.name}</h4>
                    <div className="flex items-center justify-between">
                      <p className="font-black text-brand-coral text-lg">{dest.price}</p>
                      <button 
                        onClick={() => onInfoClick(dest)}
                        className="py-3 px-6 bg-brand-teal text-white rounded-2xl font-black uppercase tracking-widest shadow-[0_4px_0_0_#3ab4ac] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 text-xs"
                      >
                        <Zap className="w-4 h-4" /> Live Insights
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-32 bg-white/5 rounded-[4rem] border-4 border-dashed border-white/10">
              <Compass className="w-20 h-20 text-white/20 mx-auto mb-8 animate-pulse" />
              <p className="text-3xl font-black text-white/40 uppercase tracking-tighter">We're still mapping this region.</p>
              <p className="font-bold text-white/20 mt-4 text-sm uppercase tracking-widest">Coming soon to your extraordinary map.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const Footer = () => {
  return (
    <footer className="py-12 bg-white px-6 border-t border-gray-100" id="main-footer">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-coral rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-lg">A</div>
            <span className="text-2xl font-black tracking-tight text-brand-ink">ABLEDINOS</span>
          </div>
          <div className="flex gap-8 font-bold text-brand-ink">
            {['Collections', 'The Mission', 'Resources'].map((item) => (
              <motion.a 
                key={item}
                href="#" 
                whileHover={{ y: -2, color: '#ff6b6b' }}
                className="transition-colors uppercase text-xs tracking-widest"
              >
                {item}
              </motion.a>
            ))}
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] pt-12 border-t border-gray-50">
          <span>© 2026 ABLEDINOS. ALL ADVENTURERS WELCOME.</span>
          <span>MADE WITH ROAR-SOME TRAVEL LOVE.</span>
        </div>
      </div>
    </footer>
  );
};

// --- Main App ---

const AppContent = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [selectedDest, setSelectedDest] = useState<any>(null);
  const [searchState, setSearchState] = useState<string | null>(null);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showTripPlanner, setShowTripPlanner] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [preSelectedDestForPlanner, setPreSelectedDestForPlanner] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [firestoreDestinations, setFirestoreDestinations] = useState<any[]>([]);

  // Load destinations from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'admin_destinations'), snap => {
      const docs = snap.docs.map((d, idx) => ({ id: d.id, ...d.data(), _idx: idx + 1 }));
      setFirestoreDestinations(docs);
    });
    return () => unsub();
  }, []);

  const handlePlanTrip = (dest: any) => {
    setPreSelectedDestForPlanner(dest);
    setShowTripPlanner(true);
    setSelectedDest(null);
  };

  const hardcodedDestinations = [
    { 
      id: 1, 
      name: 'Santorini, Greece', 
      country: 'Greece',
      placeId: 'ChIJS9_Yp9f-vxQR-M7uI_5k-S8',
      image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&q=80&w=800',
      tag: 'Romance',
      price: 'From $1,200',
      rating: 4.9,
      budget: 'luxury',
      activities: ['beaches', 'dining'],
      coords: [36.3932, 25.4615]
    },
    { 
      id: 2, 
      name: 'Kyoto, Japan', 
      country: 'Japan',
      placeId: 'ChIJO-681O0-vxQR-M7uI_5k-S8',
      image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&q=80&w=800',
      tag: 'Culture',
      price: 'From $2,400',
      rating: 4.8,
      budget: 'premium',
      activities: ['museums', 'dining'],
      coords: [35.0116, 135.7681]
    },
    { 
      id: 3, 
      name: 'Amalfi Coast, Italy', 
      country: 'Italy',
      placeId: 'ChIJNb_egh_aNxMR_S_1B6-X_6A',
      image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=800',
      tag: 'Adventure',
      price: 'From $1,800',
      rating: 5.0,
      budget: 'luxury',
      activities: ['hiking', 'dining'],
      coords: [40.6340, 14.6027]
    },
    { 
      id: 4, 
      name: 'Paris, France', 
      country: 'France',
      placeId: 'ChIJD7fiBh9u5kcRY_S_1B6-X_6A',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=800',
      tag: 'Elegance',
      price: 'From $1,500',
      rating: 4.7,
      budget: 'luxury',
      activities: ['museums', 'dining'],
      coords: [48.8566, 2.3522]
    },
    {
      id: 5,
      name: 'Reykjavik, Iceland',
      country: 'Iceland',
      placeId: 'ChIJN1t-8_u_fUURm-W3O_l-U8_',
      image: 'https://images.unsplash.com/photo-1476610182048-b716b8518aae?auto=format&fit=crop&q=80&w=800',
      tag: 'Adventure',
      price: 'From $2,100',
      rating: 4.9,
      budget: 'premium',
      activities: ['hiking'],
      coords: [64.1265, -21.8174]
    },
    {
      id: 6,
      name: 'Bali, Indonesia',
      country: 'Indonesia',
      placeId: 'ChIJN_fRfW_z0S0R6l1X_Y_P_6c',
      image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&q=80&w=800',
      tag: 'Romance',
      price: 'From $800',
      rating: 4.8,
      budget: 'economy',
      activities: ['beaches', 'dining'],
      coords: [-8.3405, 115.0920]
    },
    {
      id: 7,
      name: 'Lofoten, Norway',
      country: 'Norway',
      placeId: 'ChIJ9W681O0-vxQR-M7uI_5k-S8',
      image: 'https://images.unsplash.com/photo-1513519107127-1bed33748e4c?auto=format&fit=crop&q=80&w=800',
      tag: 'Adventure',
      price: 'From $1,900',
      rating: 4.9,
      budget: 'premium',
      activities: ['hiking'],
      coords: [68.3275, 14.5492]
    },
    {
      id: 8,
      name: 'Cairo, Egypt',
      country: 'Egypt',
      placeId: 'ChIJ3f5n_X_3yS0R-M7uI_5k-S8',
      image: 'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?auto=format&fit=crop&q=80&w=800',
      tag: 'Culture',
      price: 'From $700',
      rating: 4.6,
      budget: 'economy',
      activities: ['museums'],
      coords: [30.0444, 31.2357]
    },
    {
      id: 9,
      name: 'Rajasthan, India',
      country: 'India',
      placeId: 'ChIJ_8fRfW_z0S0R6l1X_Y_P_6c',
      image: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&q=80&w=800',
      tag: 'Culture',
      price: 'From $900',
      rating: 4.9,
      budget: 'economy',
      activities: ['museums', 'dining'],
      coords: [27.0238, 74.2179]
    },
    {
      id: 10,
      name: 'Berlin, Germany',
      country: 'Germany',
      placeId: 'ChIJN1t-8_u_fUURm-W3O_l-U8_',
      image: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&q=80&w=800',
      tag: 'Culture',
      price: 'From $1,400',
      rating: 4.7,
      budget: 'premium',
      activities: ['museums', 'dining'],
      coords: [52.5200, 13.4050]
    },
    {
      id: 11,
      name: 'Zermatt, Switzerland',
      country: 'Switzerland',
      placeId: 'ChIJNb_egh_aNxMR_S_1B6-X_6A',
      image: 'https://images.unsplash.com/photo-1502429892517-f26362e71188?auto=format&fit=crop&q=80&w=800',
      tag: 'Adventure',
      price: 'From $2,800',
      rating: 5.0,
      budget: 'luxury',
      activities: ['hiking'],
      coords: [46.0207, 7.7491]
    },
    {
      id: 12,
      name: 'Raja Ampat, Indonesia',
      country: 'Indonesia',
      placeId: 'ChIJO-681O0-vxQR-M7uI_5k-S8',
      image: 'https://images.unsplash.com/photo-1516690553959-71a414d6b9b6?auto=format&fit=crop&q=80&w=800',
      tag: 'Adventure',
      price: 'From $2,200',
      rating: 4.9,
      budget: 'premium',
      activities: ['beaches'],
      coords: [-0.2333, 130.5167]
    },
    {
      id: 13,
      name: 'Bangkok, Thailand',
      country: 'Thailand',
      placeId: 'ChIJ82u9yS6_4TARGK89_pRE1lY',
      image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&q=80&w=1200',
      tag: 'Culture',
      price: 'From $600',
      rating: 4.7,
      budget: 'economy',
      activities: ['museums', 'dining'],
      coords: [13.7563, 100.5018]
    },
    {
      id: 14,
      name: 'Phuket, Thailand',
      country: 'Thailand',
      placeId: 'ChIJA7636e0-vxQR-M7uI_5k-S8',
      image: 'https://images.unsplash.com/photo-1589308078059-be1415eab4c3?auto=format&fit=crop&q=80&w=800',
      tag: 'Romance',
      price: 'From $900',
      rating: 4.8,
      budget: 'premium',
      activities: ['beaches', 'dining'],
      coords: [7.8804, 98.3923]
    },
    {
      id: 15,
      name: 'Krabi, Thailand',
      country: 'Thailand',
      placeId: 'ChIJv8Xm9W_z0S0R6l1X_Y_P_6c',
      image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&q=80&w=1200',
      tag: 'Adventure',
      price: 'From $850',
      rating: 4.9,
      budget: 'economy',
      activities: ['hiking', 'beaches'],
      coords: [8.0855, 98.9067]
    }
  ];

  // Use Firestore destinations if available, otherwise fall back to hardcoded
  const allDestinations = firestoreDestinations.length > 0 ? firestoreDestinations : hardcodedDestinations;

  const countryDestinations = useMemo(() => {
    if (!selectedCountry) return [];
    return allDestinations.filter(d => d.country === selectedCountry);
  }, [selectedCountry, allDestinations]);

  const filteredDestinations = useMemo(() => {
    if (!searchState) return allDestinations;
    
    return allDestinations.filter(dest => 
      dest.name.toLowerCase().includes(searchState.toLowerCase()) ||
      dest.country.toLowerCase().includes(searchState.toLowerCase())
    );
  }, [searchState]);

  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-brand-bg flex flex-col items-center justify-center z-[200]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-brand-teal border-t-brand-coral rounded-full mb-8 shadow-xl"
        />
        <h1 className="text-3xl font-black text-brand-ink uppercase tracking-tighter animate-pulse">Initializing Vault...</h1>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-4">Syncing with global nodes</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg font-sans selection:bg-brand-coral selection:text-white">
      <Navbar setShowAdminPanel={setShowAdminPanel} />
      <main>
        <Hero onSearch={(term) => setSearchState(term)} destinations={allDestinations} />
        
        {searchState && (
          <section className="py-24 bg-white px-6 border-b-8 border-brand-teal/20" id="search-results-section">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                <div>
                  <h2 className="text-sm font-black text-brand-coral uppercase tracking-widest mb-2">Search Results</h2>
                  <h3 className="text-4xl font-black text-brand-ink uppercase">Found {filteredDestinations.length} Journeys</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-brand-bg p-1 rounded-2xl flex border-2 border-brand-teal/10">
                    <button 
                      onClick={() => setViewMode('grid')}
                      className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-brand-teal text-white shadow-lg' : 'text-gray-400 hover:text-brand-ink'}`}
                    >
                      <LayoutGrid className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setViewMode('map')}
                      className={`p-3 rounded-xl transition-all ${viewMode === 'map' ? 'bg-brand-teal text-white shadow-lg' : 'text-gray-400 hover:text-brand-ink'}`}
                    >
                      <MapIcon className="w-5 h-5" />
                    </button>
                  </div>
                  <button 
                    onClick={() => setSearchState(null)}
                    className="px-6 py-3 bg-brand-bg rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-brand-teal/10 transition-all border-2 border-brand-teal/10 h-[52px]"
                  >
                    Clear Search
                  </button>
                </div>
              </div>

              {filteredDestinations.length > 0 ? (
                viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredDestinations.map((dest) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        key={dest.id}
                        className="group bg-brand-bg rounded-[3rem] overflow-hidden border-4 border-brand-teal/20 hover:border-brand-teal transition-all duration-500 shadow-xl"
                      >
                        <div className="relative aspect-video">
                          <img src={dest.image} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                          <div className="absolute top-6 left-6 flex gap-2">
                            <span className="px-3 py-1 bg-brand-yellow rounded-full text-[10px] font-black uppercase text-brand-ink">{dest.tag}</span>
                            <span className="px-3 py-1 bg-brand-green rounded-full text-[10px] font-black uppercase text-white capitalize">{dest.budget}</span>
                          </div>
                        </div>
                        <div className="p-8">
                          <h4 className="text-2xl font-black text-brand-ink mb-4">{dest.name}</h4>
                          <button 
                            onClick={() => setSelectedDest(dest)}
                            className="w-full py-4 bg-brand-teal text-white rounded-2xl font-black uppercase tracking-widest shadow-[0_4px_0_0_#3ab4ac] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"
                          >
                            <Zap className="w-5 h-5" /> View Insights
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="h-[600px] w-full rounded-[3rem] overflow-hidden border-4 border-brand-teal shadow-2xl relative"
                  >
                    <Map 
                      height={600} 
                      defaultCenter={filteredDestinations[0].coords as [number, number]} 
                      defaultZoom={3}
                      maxZoom={12}
                      minZoom={2}
                    >
                      {filteredDestinations.map(dest => {
                        const MarkerComp = Marker as any;
                        return (
                          <MarkerComp 
                            key={dest.id} 
                            width={40} 
                            anchor={dest.coords as [number, number]} 
                            color="var(--color-brand-coral)"
                            onClick={() => setSelectedDest(dest)}
                          />
                        );
                      })}
                    </Map>
                    <div className="absolute bottom-8 right-8 bg-white/80 backdrop-blur-md px-6 py-3 rounded-2xl border-2 border-brand-teal/10 shadow-lg text-[10px] font-black uppercase tracking-widest text-brand-ink">
                      Click markers to view live insights
                    </div>
                  </motion.div>
                )
              ) : (
                <div className="text-center py-20 bg-brand-bg rounded-[3rem] border-4 border-dashed border-gray-200">
                  <Globe className="w-20 h-20 text-gray-200 mx-auto mb-6" />
                  <p className="text-2xl font-black text-gray-400 uppercase tracking-tighter">No destinations match your criteria</p>
                  <p className="font-bold text-gray-400 mt-2">Try adjusting your filters or search term.</p>
                </div>
              )}
            </div>
          </section>
        )}

        <Categories />

        {user && (
          <section className="py-24 bg-white px-6">
            <div className="max-w-7xl mx-auto">
              <div className="bg-brand-bg rounded-[3rem] p-12 border-4 border-brand-teal shadow-2xl relative">
                <motion.button 
                  onClick={() => setShowProfileSettings(true)}
                  whileHover={{ scale: 1.1, rotate: 15 }}
                  whileTap={{ scale: 0.9 }}
                  className="absolute top-8 right-8 p-4 bg-white rounded-2xl border-2 border-brand-teal/10 shadow-lg hover:bg-brand-teal hover:text-white transition-all group"
                  title="Profile Settings"
                >
                  <Settings className="w-6 h-6 text-brand-ink group-hover:text-white" />
                </motion.button>

                <div className="flex flex-col md:flex-row gap-12 items-center">
                  <div className="w-48 h-48 rounded-full overflow-hidden border-8 border-brand-teal/20 shadow-xl">
                    <img 
                      src={user.photoURL || 'https://via.placeholder.com/200'} 
                      alt={userProfile?.displayName || user.displayName || 'Traveler'} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-10">
                      <div className="flex-1">
                        <h4 className="text-5xl font-black mb-3 uppercase tracking-tighter text-brand-ink">
                          {userProfile?.displayName || user.displayName}'s Vault
                        </h4>
                        <div className="flex flex-wrap gap-3 mb-6">
                          <span className="px-4 py-1 bg-brand-coral/10 text-brand-coral border border-brand-coral/20 rounded-full text-[10px] font-black uppercase tracking-widest">{userProfile?.travelStyle || 'Explorer'}</span>
                          <span className="px-4 py-1 bg-brand-teal/10 text-brand-teal border border-brand-teal/20 rounded-full text-[10px] font-black uppercase tracking-widest">{userProfile?.homeBase || 'Earth'}</span>
                        </div>
                        {userProfile?.bio && (
                          <p className="text-xl font-bold text-gray-500 leading-relaxed max-w-2xl italic">
                            "{userProfile.bio}"
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-4">
                        <motion.button 
                          onClick={() => setShowTripPlanner(true)}
                          whileHover={{ scale: 1.05, y: -4 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-10 py-5 bg-brand-coral text-white rounded-[2rem] font-black uppercase tracking-widest shadow-[0_8px_0_0_#d15252] active:shadow-none transition-all flex items-center justify-center gap-3 text-sm"
                        >
                          <Calendar className="w-5 h-5" /> Open Trip Architect
                        </motion.button>
                        <div className="flex items-center justify-between px-6 py-4 bg-white rounded-2xl border-2 border-brand-teal/5 shadow-sm">
                          <div className="text-center">
                            <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">Stamps</p>
                            <p className="text-xl font-black text-brand-ink">12</p>
                          </div>
                          <div className="w-[1px] h-8 bg-gray-100"></div>
                          <div className="text-center">
                            <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">Trips</p>
                            <p className="text-xl font-black text-brand-ink">4</p>
                          </div>
                          <div className="w-[1px] h-8 bg-gray-100"></div>
                          <div className="text-center">
                            <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">Points</p>
                            <p className="text-xl font-black text-brand-yellow">850</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                       <div className="space-y-12">
                        {/* Travel Identity Card */}
                        <div className="bg-white p-8 rounded-[2.5rem] border-4 border-brand-teal/10 shadow-xl relative overflow-hidden group">
                           <div className={`absolute top-0 right-0 w-24 h-24 translate-x-8 -translate-y-8 rounded-full blur-3xl opacity-20 ${
                             (userProfile?.travelStyle === 'Luxury' ? 'bg-brand-yellow' : 
                              userProfile?.travelStyle === 'Backpacker' ? 'bg-brand-green' : 
                              userProfile?.travelStyle === 'Digital Nomad' ? 'bg-brand-teal' : 'bg-brand-coral')
                           }`}></div>
                           
                           <div className="relative">
                            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-4">Travel Identity</p>
                            <h5 className="text-3xl font-black text-brand-ink mb-2 uppercase leading-none">
                              {userProfile?.travelStyle === 'Explorer' ? 'The Cartographer' : 
                               userProfile?.travelStyle === 'Backpacker' ? 'The Wayfarer' : 
                               userProfile?.travelStyle === 'Luxury' ? 'The Connoisseur' : 
                               userProfile?.travelStyle === 'Digital Nomad' ? 'The Cyber-Traveler' : 
                               'The Observer'}
                            </h5>
                            <p className="text-sm font-bold text-gray-500 leading-relaxed italic">
                              {userProfile?.travelStyle === 'Explorer' ? 'Thriving on mapping the unmapped and finding beauty in the overlooked.' : 
                               userProfile?.travelStyle === 'Backpacker' ? 'Resourceful and agile, proving the best experiences often cost the least.' : 
                               userProfile?.travelStyle === 'Luxury' ? 'Having an eye for excellence and seeking the pinnacle of comfort and design.' : 
                               userProfile?.travelStyle === 'Digital Nomad' ? 'Your office is the world, gathering inspiration from changing horizons.' : 
                               'Not just visiting places, but inhabiting them and savoring every detail.'}
                            </p>
                           </div>

                           <div className="mt-8 pt-6 border-t border-gray-50">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-black uppercase text-gray-400">Level 8 Traveler</span>
                                <span className="text-[10px] font-black text-brand-teal">85% to Level 9</span>
                              </div>
                              <div className="h-3 w-full bg-brand-bg rounded-full overflow-hidden border border-brand-teal/5">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: '85%' }}
                                  className="h-full bg-brand-teal rounded-full"
                                ></motion.div>
                              </div>
                           </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-brand-coral/10 rounded-xl flex items-center justify-center">
                              <Heart className="w-5 h-5 text-brand-coral" />
                            </div>
                            <h5 className="text-lg font-black uppercase tracking-widest text-brand-ink">Dream Destinations</h5>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {(userProfile?.dreamDestinations || "Tokyo, Iceland, Santorini").split(',').map((dest: string, i: number) => (
                              <span key={i} className="px-5 py-3 bg-white border-2 border-brand-teal/10 rounded-2xl font-bold text-gray-600 shadow-sm hover:border-brand-teal transition-all cursor-default">
                                {dest.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-2 space-y-12">
                        {/* Digital Passport / Stamps */}
                        <div className="bg-white p-10 rounded-[3rem] border-4 border-brand-teal/5 shadow-2xl relative">
                           <div className="flex items-center justify-between mb-10">
                              <div>
                                <h5 className="text-2xl font-black text-brand-ink uppercase tracking-tight">Digital Passport</h5>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Your verified journey evidence</p>
                              </div>
                              <Award className="w-10 h-10 text-brand-teal opacity-20" />
                           </div>

                           <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-8">
                              {[
                                { name: 'Santorini', color: 'bg-brand-teal' },
                                { name: 'Tokyo', color: 'bg-brand-coral' },
                                { name: 'Paris', color: 'bg-brand-ink' },
                                { name: 'Amalfi', color: 'bg-brand-green' },
                                { name: 'Kyoto', color: 'bg-brand-yellow' },
                              ].map((stamp, i) => (
                                <motion.div 
                                  key={i}
                                  whileHover={{ rotate: 15, scale: 1.1 }}
                                  className="flex flex-col items-center gap-3"
                                >
                                  <div className={`w-16 h-16 rounded-full ${stamp.color} flex items-center justify-center border-4 border-white shadow-xl rotate-${i % 2 === 0 ? '3' : '-3'}`}>
                                    <Globe className="w-8 h-8 text-white opacity-80" />
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-ink bg-white px-3 py-1 rounded-full border border-brand-teal/10 shadow-sm">
                                    {stamp.name}
                                  </span>
                                </motion.div>
                              ))}
                              {/* Empty slots */}
                              {[1, 2, 3, 4, 5].map((_, i) => (
                                 <div key={i} className="w-16 h-16 rounded-full border-4 border-dashed border-gray-100 flex items-center justify-center">
                                    <Plus className="w-6 h-6 text-gray-100" />
                                 </div>
                              ))}
                           </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-brand-green/10 rounded-xl flex items-center justify-center">
                              <Zap className="w-5 h-5 text-brand-green" />
                            </div>
                            <h5 className="text-lg font-black uppercase tracking-widest text-brand-ink">Travel Interests</h5>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {(userProfile?.interests || "Hiking, Food, Photography, Art").split(',').map((interest: string, i: number) => (
                              <span key={i} className="px-5 py-3 bg-white border-2 border-brand-teal/10 rounded-2xl font-bold text-gray-600 shadow-sm hover:border-brand-teal transition-all cursor-default">
                                {interest.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <AnimatePresence>
          {showProfileSettings && (
            <ProfileSettings onClose={() => setShowProfileSettings(false)} />
          )}
          {showTripPlanner && (
            <TripPlanner 
              onClose={() => { setShowTripPlanner(false); setPreSelectedDestForPlanner(null); }} 
              initialDestination={preSelectedDestForPlanner}
              destinations={allDestinations}
            />
          )}
          {selectedCountry && (
            <CountryExplorer 
              country={selectedCountry} 
              destinations={countryDestinations} 
              onInfoClick={(dest) => setSelectedDest(dest)}
              onClose={() => setSelectedCountry(null)} 
            />
          )}
        </AnimatePresence>

        <FeaturedDestinations onInfoClick={(dest) => setSelectedDest(dest)} />
        
        <AnimatePresence>
          {selectedDest && (
            <DestinationPage 
              destination={selectedDest} 
              onClose={() => setSelectedDest(null)} 
              onPlanTrip={handlePlanTrip}
            />
          )}
        </AnimatePresence>
        
        {/* Explore by Country */}
        <section className="py-24 bg-brand-bg px-6">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-4xl font-black tracking-tight mb-4 uppercase text-brand-ink">Explore by Country</h3>
            <p className="font-bold text-gray-600 mb-12">Tap any country to discover its cities, restaurants, and attractions.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {['France', 'Japan', 'Greece', 'Italy', 'Iceland', 'Norway', 'Portugal', 'Spain', 'Thailand', 'Vietnam', 'Morocco', 'Egypt', 'India', 'Germany', 'Switzerland', 'Indonesia'].map((country) => (
                <motion.button 
                  key={country}
                  onClick={() => setSelectedCountry(country)}
                  whileHover={{ scale: 1.05, y: -4, backgroundColor: '#3ab4ac', color: '#ffffff' }}
                  whileTap={{ scale: 0.95 }}
                  className="p-6 bg-white border-4 border-brand-teal/20 rounded-3xl transition-all text-xs font-black uppercase tracking-widest text-center shadow-lg"
                  id={`country-${country.toLowerCase()}`}
                >
                  {country}
                </motion.button>
              ))}
            </div>
          </div>
        </section>

        <TipsSection />
        
        {/* About / Mission Section */}
        <section className="py-24 bg-brand-ink text-white px-6 overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
              <div>
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-5xl md:text-7xl font-black tracking-tighter leading-none mb-12"
                >
                  We believe travel is the best <span className="text-white/40">education.</span>
                </motion.h2>
                <div className="grid grid-cols-2 gap-12">
                  <div>
                    <p className="text-4xl font-black mb-2 tracking-tighter transition-all hover:scale-110 origin-left">12k+</p>
                    <p className="text-white/40 text-sm uppercase tracking-widest font-black">Journeys Planned</p>
                  </div>
                  <div>
                    <p className="text-4xl font-black mb-2 tracking-tighter transition-all hover:scale-110 origin-left">98%</p>
                    <p className="text-white/40 text-sm uppercase tracking-widest font-black">Happy Explorers</p>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-video bg-white/5 rounded-[3rem] border-8 border-white/10 p-2 overflow-hidden shadow-2xl">
                  <img 
                    src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=1200" 
                    alt="Travelers on adventure"
                    className="w-full h-full object-cover rounded-[2.5rem] opacity-80"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button className="w-24 h-24 bg-brand-teal text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-[0_8px_0_0_#3ab4ac] active:translate-y-1 active:shadow-none">
                      <ChevronRight className="w-10 h-10" />
                    </button>
                  </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-brand-coral/20 rounded-full blur-[100px] -z-10"></div>
                <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-brand-teal/20 rounded-full blur-[100px] -z-10"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Explore more button */}
        <section className="py-32 text-center px-6 bg-brand-yellow">
          <h3 className="text-4xl md:text-6xl font-black mb-12 tracking-tight text-brand-ink">Ready for your next <br/>extraordinary journey?</h3>
          <button className="px-12 py-6 bg-brand-coral text-white rounded-[2rem] text-2xl font-black shadow-[0_8px_0_0_#d15252] hover:scale-105 active:translate-y-2 active:shadow-none transition-all uppercase tracking-tight">
            Start Exploring Now
          </button>
        </section>
      </main>
      <Footer />
      <AnimatePresence>
        {showAdminPanel && isAdminUser(user?.email) && (
          <AdminPanel onClose={() => setShowAdminPanel(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default function AbledinosApp() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
