'use client';
import Image from 'next/image';

interface InstagramPost {
  id: string;
  image: string;
  caption: string;
  likes: number;
  comments: number;
  url: string;
  isVideo?: boolean;
}

const INSTAGRAM_POSTS: InstagramPost[] = [
  {
    id: '1',
    image: '/instagram/post1.jpg',
    caption: 'DLC Nominees announced! 🗳️ Nominations for District 224 Leadership Team (2026-27) are out: Shwetank Sharma (District Director), Kashish Gupta (PQD), Khushal Lalwani (CGD), Bilvaa Desai, Navya Gupta, Abhishek Deoraj. All the best to our upcoming leaders! #D224 #Toastmasters',
    likes: 68,
    comments: 14,
    url: 'https://www.instagram.com/d224toastmasters?igsh=MWMwb2QxNTczMHJlag==',
  },
  {
    id: '2',
    image: '/instagram/post2.jpg',
    caption: 'Article Writing Contest! ✍️ Submit your original articles on the theme \'Tabula Rasa\' to nirmikatoastmasters@gmail.com by 16th August 2026. Top 3 entries will be featured in the upcoming District 224 newsletter! #TabulaRasa #Newsletter #WritingContest',
    likes: 42,
    comments: 6,
    url: 'https://www.instagram.com/d224toastmasters?igsh=MWMwb2QxNTczMHJlag==',
  },
  {
    id: '3',
    image: '/instagram/post3.jpg',
    caption: 'Moments of Truth 📊 A club\'s health check is vital! We invite all Club Officers to conduct \'Moments of Truth\' and submit the reports by 31st August 2026. Let\'s build stronger clubs together! #ClubQuality #MomentsOfTruth #District224',
    likes: 57,
    comments: 9,
    url: 'https://www.instagram.com/d224toastmasters?igsh=MWMwb2QxNTczMHJlag==',
  },
  {
    id: '4',
    image: '/instagram/post4.jpg',
    caption: 'Toastmasters Leadership Program (TLI) 🎓 Mark your calendars for August 22, 2026 (10:00 AM - 1:00 PM). A district-wide training session on Zoom to help you lead with purpose. #TLI #LeadershipTraining #District224',
    likes: 83,
    comments: 11,
    url: 'https://www.instagram.com/d224toastmasters?igsh=MWMwb2QxNTczMHJlag==',
  },
  {
    id: '5',
    image: '/instagram/post5.jpg',
    caption: 'PR Toolkit Launched! 🎨 VPEs, VPPRs, and Club Officers: Access our new PR Corner! Grab pre-designed Canva templates, customized zoom backgrounds, and official Toastmasters branding kits from district224.org. #PRToolkit #Branding #PublicRelations',
    likes: 71,
    comments: 8,
    url: 'https://www.instagram.com/d224toastmasters?igsh=MWMwb2QxNTczMHJlag==',
  },
  {
    id: '6',
    image: '/instagram/post6.jpg',
    caption: 'Welcome to all our guests! Toastmasters is a supportive environment where you can learn by doing. Join us this Saturday! 🤝❤️ #Networking #Learning #Toastmasters',
    likes: 95,
    comments: 19,
    url: 'https://www.instagram.com/d224toastmasters?igsh=MWMwb2QxNTczMHJlag==',
  },
  {
    id: '7',
    image: '/instagram/post7.jpg',
    caption: 'Meeting #505 of Dehradun WIC India Toastmasters Club! A power-packed meeting with amazing speeches. 🎤✨ #Toastmasters #Dehradun #PublicSpeaking',
    likes: 89,
    comments: 15,
    url: 'https://www.instagram.com/d224toastmasters?igsh=MWMwb2QxNTczMHJlag==',
  },
];

export function InstagramFeed() {
  const profileUrl = 'https://www.instagram.com/d224toastmasters?igsh=MWMwb2QxNTczMHJlag==';

  return (
    <div className="bg-navy-600 text-stone-100 rounded-2xl border border-white/5 overflow-hidden shadow-xl max-w-2xl mx-auto">
      
      {/* Profile Header */}
      <div className="p-6 md:p-8 border-b border-white/5 bg-navy-700/50">
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          
          {/* Avatar with Insta-gradient ring */}
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative p-1 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 hover:scale-105 transition-transform duration-300"
          >
            <div className="bg-navy-700 rounded-full p-1">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-white">
                <Image
                  src="/instagram/profile.png"
                  alt="District 224 Toastmasters Logo"
                  fill
                  sizes="(max-width: 640px) 80px, 96px"
                  className="object-contain p-1.5"
                  priority
                />
              </div>
            </div>
          </a>

          {/* User Details */}
          <div className="flex-1 text-center sm:text-left space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-center sm:justify-start">
              <h2 className="text-xl font-semibold tracking-tight text-white">d224toastmasters</h2>
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold px-6 py-2 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Follow
              </a>
            </div>

            {/* Stats */}
            <div className="flex justify-center sm:justify-start gap-8 text-sm">
              <div>
                <span className="font-bold text-white">1,730</span> posts
              </div>
              <div>
                <span className="font-bold text-white">1,534</span> followers
              </div>
              <div>
                <span className="font-bold text-white">43</span> following
              </div>
            </div>

            {/* Bio */}
            <div className="text-sm space-y-1">
              <p className="font-bold text-white">District 224 Toastmasters International</p>
              <p className="text-white/80">🗣️ Communication &amp; Leadership Development</p>
              <p className="text-white/80">📍 Serving 150+ active clubs across North &amp; West India</p>
              <a
                href="https://d224toastmasters.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-200 hover:underline font-semibold block mt-1"
              >
                d224toastmasters.org
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Header Tabs */}
      <div className="flex justify-center border-b border-white/5 bg-navy-700/20">
        <button className="flex items-center gap-1.5 py-4 px-6 border-t-2 border-yellow-200 text-xs font-bold uppercase tracking-wider text-yellow-200">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2 2h20v20H2V2zm2 2v4h4V4H4zm6 0v4h4V4h-4zm6 0v4h4V4h-4zM4 10v4h4v-4H4zm6 0v4h4v-4h-4zm6 0v4h4v-4h-4zM4 16v4h4v-4H4zm6 0v4h4v-4h-4zm6 0v4h4v-4h-4z"/>
          </svg>
          Posts
        </button>
      </div>

      {/* Photo Grid */}
      <div className="p-4 md:p-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {INSTAGRAM_POSTS.map((post) => (
            <a
              key={post.id}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative aspect-square block overflow-hidden rounded-lg group bg-black cursor-pointer shadow-md"
            >
              {/* Image */}
              <Image
                src={post.image}
                alt={post.caption}
                fill
                sizes="(max-width: 768px) 33vw, 200px"
                className="object-cover group-hover:scale-105 group-hover:opacity-80 transition-all duration-300"
              />

              {/* Video Badge (if applicable) */}
              {post.isVideo && (
                <div className="absolute top-2 right-2 text-white drop-shadow-md">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-6 text-white font-bold text-sm sm:text-base">
                <span className="flex items-center gap-1.5 drop-shadow-md">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                  {post.likes}
                </span>
                <span className="flex items-center gap-1.5 drop-shadow-md">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/>
                  </svg>
                  {post.comments}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
      
      {/* Footer Call to Action */}
      <div className="p-6 text-center border-t border-white/5 bg-navy-700/30">
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold text-yellow-200 hover:text-yellow-100 hover:underline transition-colors"
        >
          View all posts on Instagram ↗
        </a>
      </div>

    </div>
  );
}
