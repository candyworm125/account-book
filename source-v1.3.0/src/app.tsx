import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import RecordPage from "@/pages/RecordPage/RecordPage";
import HistoryPage from "@/pages/HistoryPage/HistoryPage";
import ProfilePage from "@/pages/ProfilePage/ProfilePage";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<RecordPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
