import './globals.css';
import { Inter } from 'next/font/google';
import { ThirdwebProviderWrapper } from './ThirdwebProviderWrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'DRUB Dashboard',
  description: 'Decentralized Ruble Lending Dashboard',
  icons: {
    icon: '/RUB.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-aave-dark-blue`}>
        <div className="flex flex-col min-h-screen">
          <main className="flex-grow">
            <ThirdwebProviderWrapper>{children}</ThirdwebProviderWrapper>
          </main>
          <footer className="text-center p-4 mt-auto border-t border-gray-800 text-aave-text-dark">
            <div className="max-w-4xl mx-auto flex justify-center items-center space-x-6">
              <a
                href="https://lookhook.info/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-aave-light-blue transition-colors"
              >
                Developed by lookhook.info
              </a>
              <a
                href="https://github.com/CoinInsider/testrub/blob/main/README.md"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-aave-light-blue transition-colors"
              >
                View on GitHub
              </a>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
