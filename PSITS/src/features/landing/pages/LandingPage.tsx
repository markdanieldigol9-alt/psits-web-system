import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/shared/components/Form';

export const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Navbar */}
      <nav className="fixed top-0 w-full glass z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex-shrink-0 flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                P
              </div>
              <span className="font-bold text-xl tracking-tight">PSITS Region XII</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="text-gray-600 hover:text-primary font-medium transition-colors px-3 py-2">
                Login
              </Link>
              <Link to="/register">
                <Button variant="primary">Join PSITS</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-16 sm:pt-40 sm:pb-24 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          
          {/* Decorative background blobs */}
          <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/30 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-pulse-slow"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-info/30 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-secondary/30 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-pulse-slow" style={{ animationDelay: '2s' }}></div>

          <div className="text-center relative z-10 animate-slide-up">
            <h1 className="text-5xl tracking-tight font-extrabold text-gray-900 sm:text-6xl md:text-7xl">
              <span className="block mb-2">Empowering IT Students</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-gray-600">
              The official website for the Philippine Society of Information Technology Students. 
              Manage events, process registrations, and collaborate with industry leaders.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Link to="/register">
                <Button size="lg" variant="primary" className="shadow-lg hover:shadow-primary/30">
                  Get Started <ChevronRight size={20} />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="bg-white">
                  Member Portal
                </Button>
              </Link>
            </div>
          </div>


        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">P</div>
              <span className="font-bold text-lg">PSITS Region XII</span>
            </div>
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} Philippine Society of Information Technology Students Region XII. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
