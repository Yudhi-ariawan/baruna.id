import { createFileRoute } from "@tanstack/react-router";
import {
  MessagesSquare,
  Home,
  MessageCircle,
  UsersRound,
  Contact,
  Network,
  Mail,
  Bell,
  Hash,
  Share2,
  ClipboardList,
  Bookmark,
  Heart,
  Plus,
  Search,
  MessageSquare,
  ThumbsUp,
  MoreHorizontal,
  Calendar,
  ArrowRight,
  Globe,
} from "lucide-react";
import { PageShell } from "@/components/baruna/page/PageShell";
import { Banner } from "@/components/baruna/page/Banner";
import { Panel, SectionHeader, CategoryBadge } from "@/components/baruna/page/primitives";
import { pageImages, courseImages, expertImages } from "@/data/pages";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community — BARUNA" },
      {
        name: "description",
        content:
          "Join a global network of marine and fisheries professionals. Share knowledge, ask questions, and collaborate for impact.",
      },
      { property: "og:title", content: "Community — BARUNA" },
      { property: "og:description", content: "Communities of practice, discussions, Q&A, and professional groups." },
      { property: "og:image", content: pageImages.bannerUnderwater },
    ],
    links: [{ rel: "canonical", href: "/community" }],
  }),
  component: CommunityPage,
});

const mainMenu = [
  { label: "Community Home", icon: Home, active: true },
  { label: "Discussions", icon: MessageCircle },
  { label: "Groups", icon: UsersRound },
  { label: "Member Directory", icon: Contact },
  { label: "My Network", icon: Network },
  { label: "Messages", icon: Mail },
  { label: "Notifications", icon: Bell },
];

const explore = [
  { label: "Topics", icon: Hash },
  { label: "Resource Sharing", icon: Share2 },
];

const myActivity = [
  { label: "My Contributions", icon: ClipboardList },
  { label: "Saved Items", icon: Bookmark },
  { label: "Following", icon: Heart },
];

const discussions = [
  { tag: "Question", author: "Dr. Andi Pratama", location: "Indonesia", time: "2 hours ago", title: "Best practices for community-based marine conservation?", excerpt: "Looking for examples of successful community-based approaches in protecting coral reefs.", comments: 12, likes: 24, avatar: expertImages[1] },
  { tag: "Discussion", author: "Maria Santos", location: "Philippines", time: "5 hours ago", title: "Innovations in Seaweed Farming 2026", excerpt: "Let's share the latest innovations and technologies in sustainable seaweed cultivation.", comments: 18, likes: 36, avatar: expertImages[4] },
  { tag: "Resource", author: "Rizky Fauzi", location: "Indonesia", time: "1 day ago", title: "New Policy Brief on Marine Spatial Planning 2026", excerpt: "Just uploaded a new policy brief on MSP best practices. Hope this is useful for everyone!", comments: 8, likes: 21, avatar: expertImages[5] },
  { tag: "Poll", author: "Lina Chen", location: "China", time: "1 day ago", title: "Which ocean issue should we prioritize in 2026?", excerpt: "Vote for the most critical ocean issue that needs our collective attention this year.", comments: 15, likes: 30, avatar: expertImages[2] },
];

const groups = [
  { name: "Marine Conservation Network", members: "2,156 members", desc: "Collaboration for marine biodiversity protection and conservation.", image: courseImages[3] },
  { name: "Sustainable Fisheries Community", members: "1,842 members", desc: "Promoting sustainable fisheries practices and responsible management.", image: courseImages[4] },
  { name: "Blue Economy Innovators", members: "1,623 members", desc: "Innovating for a sustainable and inclusive blue economy.", image: courseImages[0] },
  { name: "Ocean Education & Literacy", members: "1,289 members", desc: "Advancing ocean literacy and education for all generations.", image: courseImages[2] },
];

const events = [
  { tag: "Webinar", title: "Ocean Literacy: Building Awareness for Action", date: "15 July 2026 · 14:00 WIB", image: courseImages[2] },
  { tag: "Discussion", title: "Sustainable Fisheries: Challenges and Solutions", date: "22 July 2026 · 10:00 WIB", image: courseImages[1] },
  { tag: "Live Chat", title: "Ask the Expert: Marine Conservation", date: "29 July 2026 · 16:00 WIB", image: courseImages[3] },
];

const trending = [
  { tag: "BlueEconomy", posts: "1,256 posts" },
  { tag: "MarineConservation", posts: "987 posts" },
  { tag: "SustainableFisheries", posts: "873 posts" },
  { tag: "OceanGovernance", posts: "654 posts" },
  { tag: "ClimateChange", posts: "542 posts" },
];

const memberAvatars = [...expertImages, pageImages.userAvatar, ...expertImages].slice(0, 11);

function CommunityPage() {
  return (
    <PageShell
      sidebar={{
        icon: MessagesSquare,
        title: "Community",
        subtitle: "Connect, collaborate, and share knowledge with marine and fisheries professionals worldwide.",
        sections: [
          { label: "Main Menu", items: mainMenu },
          { label: "Explore", items: explore },
          { label: "My Activity", items: myActivity },
        ],
        footer: { icon: Plus, label: "Create New Post" },
      }}
      cta={{
        icon: MessagesSquare,
        title: "Share Knowledge. Build Connections. Create Impact.",
        description: "Together, we can achieve a sustainable future for our ocean and communities.",
        button: "Explore Discussions",
      }}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-navy">Community</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Join a global network of marine and fisheries professionals. Share knowledge, ask questions, and collaborate for impact.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-soft">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Search discussions, members, groups, or topics..." />
            </div>
            <button className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-soft transition-colors hover:bg-accent/90">
              <Plus className="h-4 w-4" /> New Post
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Banner
              image={pageImages.bannerUnderwater}
              alt="Sea turtle swimming over coral reef"
              title={<>Stronger Together.<br />Ocean Impact Forever.</>}
              description="Engage with our community, share your insights, and be part of solutions for a sustainable ocean."
              stats={[
                { value: "12,458", label: "Members", icon: UsersRound },
                { value: "480+", label: "Groups", icon: Network },
                { value: "2,350+", label: "Discussions", icon: MessageCircle },
                { value: "120+", label: "Countries", icon: Globe },
              ]}
            />

            <section>
              <SectionHeader title="Featured Discussions" action="View all discussions" />
              <div className="grid gap-4 sm:grid-cols-2">
                {discussions.map((d) => (
                  <article key={d.title} className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-hover">
                    <CategoryBadge label={d.tag} />
                    <div className="mt-3 flex items-center gap-2">
                      <img src={d.avatar} alt={d.author} loading="lazy" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                      <div className="text-xs">
                        <p className="font-semibold text-navy">{d.author}</p>
                        <p className="text-muted-foreground">{d.location} · {d.time}</p>
                      </div>
                    </div>
                    <h3 className="mt-3 font-display text-sm font-bold leading-snug text-navy">{d.title}</h3>
                    <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">{d.excerpt}</p>
                    <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{d.comments}</span>
                      <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />{d.likes}</span>
                      <MoreHorizontal className="ml-auto h-4 w-4" />
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section>
              <SectionHeader title="Popular Groups" action="View all groups" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {groups.map((g) => (
                  <article key={g.name} className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-1 hover:shadow-hover">
                    <img src={g.image} alt={g.name} loading="lazy" width={120} height={120} className="h-14 w-14 rounded-xl object-cover" />
                    <h3 className="mt-3 font-display text-sm font-bold leading-snug text-navy">{g.name}</h3>
                    <p className="text-xs font-medium text-marine">{g.members}</p>
                    <p className="mt-1 flex-1 text-xs leading-snug text-muted-foreground">{g.desc}</p>
                    <button className="mt-3 w-full rounded-lg border border-marine py-1.5 text-xs font-semibold text-marine transition-colors hover:bg-marine hover:text-marine-foreground">Join</button>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <Panel>
              <SectionHeader title="Upcoming Community Events" />
              <ul className="space-y-4">
                {events.map((e) => (
                  <li key={e.title} className="flex gap-3">
                    <img src={e.image} alt={e.title} loading="lazy" width={56} height={56} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <span className="inline-flex rounded bg-secondary px-1.5 py-0.5 text-[0.6rem] font-bold text-marine">{e.tag}</span>
                      <h3 className="mt-1 text-sm font-semibold leading-snug text-navy">{e.title}</h3>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{e.date}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel>
              <SectionHeader title="Trending Topics" />
              <ul className="space-y-3">
                {trending.map((t) => (
                  <li key={t.tag} className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm font-semibold text-marine"><Hash className="h-3.5 w-3.5" />{t.tag}</span>
                    <span className="text-xs text-muted-foreground">{t.posts}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel>
              <SectionHeader title="Active Members" />
              <div className="flex flex-wrap gap-2">
                {memberAvatars.map((a, i) => (
                  <img key={i} src={a} alt="Member" loading="lazy" width={40} height={40} className="h-10 w-10 rounded-full object-cover ring-2 ring-card" />
                ))}
                <span className="grid h-10 w-10 place-items-center rounded-full bg-marine/10 text-xs font-bold text-marine">+120</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">12,458+ members worldwide</p>
            </Panel>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
