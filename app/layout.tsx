import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'CampusMatch · AI & BI',description:'Kết nối kỹ năng, khám phá cơ hội. Bản mẫu tuyển dụng thông minh dành cho sinh viên.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>}
