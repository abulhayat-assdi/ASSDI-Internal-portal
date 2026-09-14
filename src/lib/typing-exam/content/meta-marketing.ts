// Category: Meta Marketing
// ~10 passages, ~500 words each, English. Fill in via content-writing pass.
import type { ExamPassage } from "./types";

function wc(text: string): number {
  return text.trim().split(/\s+/).length;
}

const ARTICLES: { title: string; text: string }[] = [
  {
    title: "Getting Started with Meta Ads Manager",
    text: `Every advertiser who wants to run paid campaigns on Facebook and Instagram eventually opens the same tool: Ads Manager. At first glance it can feel crowded, with columns of numbers, dropdown menus, and settings that seem to multiply the deeper you go. Once you understand its basic structure, though, the tool becomes far less intimidating and far more useful.

Ads Manager is built around a three level hierarchy. At the top sits the campaign, where an advertiser chooses an overall objective, such as driving traffic to a website, generating leads, or encouraging people to install an app. Below the campaign sit one or more ad sets, which control who sees the ads, how much money is spent, and when the ads run. Inside each ad set sit the actual ads themselves, the images, videos, and text that people will see in their feeds or stories.

This layered structure exists because different parts of a campaign change at different speeds. An advertiser might want to keep the overall objective fixed for weeks while testing five different ad sets aimed at five different audiences. Or they might keep the audience steady while swapping out ad creative every few days to avoid fatigue, which happens when the same audience sees the same ad too many times and begins to tune it out.

Budgets can be set at either the campaign level or the ad set level, depending on how much control an advertiser wants over spending. A campaign level budget lets the platform automatically shift money toward whichever ad set is performing best, which suits advertisers who are comfortable letting the system optimize on their behalf. An ad set level budget gives more manual control, which suits advertisers who want to guarantee a minimum amount of exposure for a particular audience regardless of how it compares to others.

New users often make the mistake of building overly complex account structures before they have any performance data to justify the complexity. A far better approach is to start simple: one clear objective, one or two ad sets with genuinely different audiences, and a small number of ad variations. Watching how this simple structure performs over a week or two teaches an advertiser more than any amount of guessing about targeting or creative choices ever could.

Learning Ads Manager is less about memorizing every button and more about understanding this underlying logic: campaigns set direction, ad sets set audience and budget, and ads carry the message. Once that structure is clear, the interface stops feeling like a maze and starts feeling like a set of dials an advertiser can turn with intention, adjusting one variable at a time and learning from what the data shows.`,
  },
  {
    title: "Understanding Audience Targeting on Meta Platforms",
    text: `One of the reasons social media advertising became so popular with small and large businesses alike is the promise of reaching the right person rather than just any person. Audience targeting is the mechanism that makes this possible, and understanding how it works helps advertisers spend their budgets far more wisely.

At a broad level, targeting tools generally fall into a few categories. Demographic and location targeting lets an advertiser choose things like age range, general location, and language, which is useful for businesses that only serve a particular city or region. Interest based targeting lets an advertiser reach people who have shown interest in related topics, useful for reaching an audience that does not yet know a brand exists but is likely to care about what it offers. Behavioral signals can add another layer, reflecting patterns such as how people tend to interact with content on the platform.

A second major category is custom audiences, built from information a business already has, such as a list of past customers or people who have visited a particular website. This approach tends to perform well because it starts from people who already have some relationship with the business, even if that relationship is as simple as having browsed a product page once before.

A third and increasingly important category is lookalike audiences. Once a business has a solid custom audience, the platform can analyze the shared characteristics of those people and find a wider group who resembles them in relevant ways. This is powerful because it extends the reach of a campaign beyond people a business already knows, while still aiming at people statistically similar to proven customers rather than a random slice of the population.

Good targeting is not just about casting the widest possible net. In fact, overly broad targeting often wastes budget on people who were never going to be interested in the first place. The more useful skill is narrowing an audience just enough that the message feels relevant without narrowing it so much that there are too few people left to reach efficiently. This balance usually takes some testing to find, and it will look different for a local bakery than for a national online retailer.

Ultimately, targeting works best when it is paired with a clear understanding of who the ideal customer actually is. No amount of clever settings can compensate for a business that has not thought carefully about who it is trying to reach and why that person would care about what is being offered. Targeting tools amplify a clear strategy; they cannot invent one from nothing.

Exclusion settings deserve just as much attention as the audiences a campaign is trying to reach. Advertisers can often prevent overlap between ad sets by excluding people already reached by another campaign, or exclude existing customers from an ad meant purely to attract new ones. Without this kind of exclusion, budgets can quietly waste money showing the same message to the same people through multiple overlapping campaigns, a mistake that is easy to make and easy to avoid once an advertiser knows to check for it.`,
  },
  {
    title: "Organic Reach versus Paid Reach on Facebook and Instagram",
    text: `Businesses that post on Facebook and Instagram quickly encounter a simple but sometimes frustrating reality: not everyone who follows a page will see everything that page posts. This is the difference between organic reach, which is the free, unpaid distribution of content to an audience, and paid reach, which is distribution that a business pays to guarantee.

Organic reach depends heavily on how the underlying feed algorithm decides what to show people. These systems generally try to show each person content they are likely to find interesting or engaging, based on their past behavior. A post that gets comments, shares, and genuine engagement early on tends to be shown to more people than one that sits quietly with no interaction. This means organic reach rewards content that sparks a real reaction, not just content that a business wants people to see.

Paid reach works differently. Rather than depending entirely on algorithmic judgments about relevance, an advertiser pays to have content shown to a defined audience, and that guarantee is part of what the payment buys. This does not mean paid content ignores relevance entirely; ads still perform better when they are well targeted and well made, and platforms often reward higher quality ads with better distribution for the same budget. But the fundamental difference remains: paid reach is bought, organic reach is earned.

Neither approach should be used in isolation. Organic content builds a foundation of trust and personality for a brand. It shows the human side of a business, answers questions, and creates a sense of community that people can return to even when no campaign is actively running. Paid content, meanwhile, is far more reliable for reaching new people at scale and for hitting specific business goals within a defined timeframe, such as promoting a limited time offer or launching a new product.

A common strategy is to use organic posts to test ideas cheaply. A business might post several variations of a message organically, see which one resonates most with its existing audience, and then put paid budget behind the version that performed best. This lets a business make paid spending decisions based on real signals rather than guesses.

Small businesses in particular benefit from understanding this balance clearly. Relying only on organic reach in a crowded feed environment can mean a shrinking share of an audience actually sees any given post over time. Relying only on paid reach without building any organic presence can make a brand feel hollow, present only when it wants something. The strongest social media presence, in most cases, blends both deliberately.

It also helps to remember that organic reach is not fixed; it shifts as feed algorithms are updated and as audience behavior changes over time. A business that once enjoyed strong organic visibility may find that same effort reaching fewer people a year later, not because its content got worse but because the surrounding environment changed. Tracking organic performance over time, rather than assuming it will stay constant, helps a business notice these shifts early and adjust its mix of organic and paid effort before results quietly decline.`,
  },
  {
    title: "What the Meta Pixel Does and Why It Matters",
    text: `Behind many of the ads that follow people around the internet, quietly suggesting a product they looked at days earlier, sits a small piece of tracking technology commonly known as a pixel. Understanding what a pixel does, in general terms, helps demystify one of the more technical corners of digital marketing.

At its core, a pixel is a short snippet of code that a business places on its own website. When a visitor loads a page containing that code, a small signal is sent back to the advertising platform, recording that a visit happened. On its own, this is a fairly simple idea: it lets a business know that someone who saw an ad, or who might see a future ad, actually came to the website.

The real value of this tracking comes from what businesses can build on top of it. First, it allows for measurement of whether advertising actually leads to meaningful outcomes, such as a completed purchase or a submitted form, rather than just clicks that may or may not turn into anything. Without this kind of tracking, a business advertising online would be left guessing whether its campaigns were actually working or simply generating traffic that went nowhere.

Second, pixel data allows a business to build custom audiences based on website behavior, such as people who visited a product page but did not complete a purchase. These visitors can then be shown a follow up ad, a practice generally called retargeting, which tends to perform well because it reaches people who have already expressed some interest rather than complete strangers.

Third, this same data feeds into the lookalike audience tools discussed elsewhere in digital marketing, letting a platform find new people who share relevant characteristics with those who previously took a valuable action on a website.

None of this is free of responsibility. As tracking technology has become more visible to the general public, expectations around transparency and consent have grown accordingly. Businesses using pixel based tracking are generally expected to disclose it clearly, often through a privacy policy and a cookie consent notice, and to respect the choices visitors make about whether they wish to be tracked at all. Regulations in various countries have also shaped how this technology can be used, and thoughtful marketers treat compliance as a basic cost of doing business rather than an afterthought.

For a small business owner just starting to advertise online, the pixel can feel like an intimidating piece of technical setup. In practice, it is usually a short block of code added once to a website, after which it works quietly in the background, turning vague guesses about advertising effectiveness into something a business can actually measure and improve over time.`,
  },
  {
    title: "Marketing Your Business Through WhatsApp Business",
    text: `For many small business owners, especially in regions where messaging apps are a primary way people communicate, WhatsApp Business offers a marketing channel that feels less like advertising and more like ordinary conversation. Understanding how it differs from a traditional storefront or a social media page helps explain why so many merchants have adopted it.

At its simplest, WhatsApp Business is a version of the familiar messaging app built specifically for merchants and service providers. It allows a business to set up a profile with basic information such as hours of operation, location, and a short description, so that customers can find essential details without needing to ask. It also supports quick, templated replies to common questions, which helps a business respond faster even when the person managing the account is busy with other tasks.

What sets this channel apart from many others is the directness of the relationship it enables. A customer messaging a business on WhatsApp is often already close to making a decision, whether that is placing an order, confirming a delivery time, or asking a specific question about a product. This is quite different from someone scrolling past an ad or a social post, who may only be in the earliest stages of noticing a brand exists.

Because of this directness, businesses using WhatsApp for marketing tend to focus on service and responsiveness rather than broad promotional messaging. Sending frequent, unsolicited promotional messages to a personal messaging app can feel intrusive in a way that a public social media post does not, and customers who feel spammed can simply block a business without much friction. The businesses that succeed on this channel generally treat it as a place for helpful, timely communication rather than a broadcast megaphone.

Order confirmations, shipping updates, appointment reminders, and answers to product questions are all common, well received uses of the channel. Some businesses also use it to close the loop after a customer discovers them elsewhere, such as through a social media ad, by making it easy to move the conversation into a more direct and personal space where questions can be answered quickly.

For small and local businesses in particular, this kind of direct messaging can level the playing field against larger competitors with bigger advertising budgets. A local shop that responds quickly, remembers a returning customer, and communicates clearly can build the kind of loyalty that a purely transactional online store often struggles to match. In that sense, WhatsApp Business marketing is less about clever campaigns and more about consistently good, human communication delivered through a channel customers already use every day.

A simple product catalog feature also lets a business showcase what it sells directly within the app, so a customer can browse items without leaving the conversation to visit a separate website. For merchants without the time or resources to build and maintain a full online store, this offers a lightweight way to present products clearly, answer questions about them immediately, and move a curious visitor toward a completed sale within a single, familiar conversation.`,
  },
  {
    title: "Building an Engaged Community on Facebook and Instagram",
    text: `A page with a large number of followers is not the same thing as a community. Plenty of accounts accumulate followers through advertising or giveaways yet still post into what feels like silence, with few comments, little conversation, and no sense that real people are paying attention. Building an actual community around a brand on Facebook and Instagram requires a different kind of effort than simply growing a follower count.

The foundation of community building is consistency. People return to accounts that post regularly and predictably, because they come to expect something from that presence, whether it is useful information, entertainment, or a sense of connection to a brand they care about. Sporadic posting, by contrast, makes it hard for any habit or expectation to form, and audiences tend to drift away from accounts that feel inconsistent.

Beyond consistency, genuine community building depends on two way communication rather than one way broadcasting. Replying to comments, answering questions in a timely way, and acknowledging when followers share their own experiences all signal that there are real people behind an account, not just a content calendar being executed on autopilot. Businesses that treat their comment sections as an afterthought miss one of the most valuable parts of having a social media presence at all: direct, low cost feedback from the people they are trying to serve.

User generated content plays an important role as well. When a business shares photos, stories, or reviews from actual customers, it does two things at once. It provides content that feels authentic rather than polished and promotional, and it makes the customers who were featured feel genuinely seen and valued, which often turns them into more loyal, vocal supporters of the brand.

Groups, whether built around a specific interest, a shared location, or a shared identity like alumni of a particular program, offer another path to deeper community. Unlike a standard page, a well run group can develop its own internal culture, with members interacting with each other and not only with the business behind it. This kind of peer to peer connection tends to be stickier than any single post, because people come to value the group itself, not just the brand that started it.

None of this happens quickly. Community building is fundamentally a long term investment, closer to tending a garden than flipping a switch. Businesses that expect an engaged, loyal following within a few weeks of posting are usually disappointed. Those that commit to showing up consistently, listening actively, and treating their audience as participants rather than spectators tend to find that the community they build becomes one of their most valuable and resilient marketing assets over time.

Handling criticism openly, rather than deleting every negative comment, also shapes how a community perceives a brand. A thoughtful, calm public reply to a complaint often does more to build trust among onlookers than a stream of only positive comments ever could, since it shows how a business behaves when things do not go perfectly. Communities tend to trust brands that seem honest about their imperfections far more than brands that appear to curate away every trace of criticism.`,
  },
  {
    title: "Reels and the Rise of Short-Video Marketing",
    text: `Short form video has reshaped how people discover brands online, and Reels represent one of the clearest examples of this shift within the Meta family of apps. Understanding why this format has become so central to marketing strategy requires looking at both how people consume content today and how the underlying distribution systems tend to favor this kind of media.

Attention spans in a fast scrolling feed environment are short, and short video meets people where they already are. A fifteen or thirty second clip can communicate a joke, a product demonstration, a behind the scenes moment, or a tip in a way that a static image often cannot, simply because motion, sound, and pacing add dimensions that a still photo lacks. This makes short video especially effective at stopping the scroll, which is often the hardest part of any piece of content's job.

From a distribution standpoint, short video content has generally been given significant visibility by the underlying algorithms of major platforms, partly because it keeps people engaged within the app for longer stretches of time. This has meant that even accounts with relatively small followings can sometimes reach large new audiences through a single well made short video, something that is far less common with standard image posts, which tend to be shown mostly to existing followers.

This does not mean every short video succeeds simply by existing. The format rewards a particular kind of craft: a strong opening that hooks attention within the first second or two, pacing that does not waste time on unnecessary setup, and a clear enough idea that it can be understood even with the sound off, since many people scroll with audio muted. Text overlays, captions, and visual clarity therefore matter enormously in this format.

For small businesses, short video marketing offers a genuinely accessible entry point that does not require professional equipment or a large budget. A smartphone camera, natural lighting, and a clear idea are often enough to produce content that performs well, especially when it shows something authentic, such as how a product is made or a genuine customer reaction, rather than something that feels overly staged or scripted.

The businesses that use this format most effectively tend to treat it as an ongoing practice rather than a one time experiment. Because short video performance can vary considerably from one piece of content to the next, consistent posting and a willingness to learn from what resonates, rather than chasing a single viral moment, tends to produce more reliable long term results.

Repurposing is another practical habit worth building. A single day of filming, whether at an event, in a workshop, or simply while preparing a product, can often be cut into several separate short videos rather than one long piece of content. This approach lets a small team produce a steady stream of material without needing to plan an entirely new shoot every time, which makes consistent posting considerably more sustainable over the weeks and months that community building genuinely requires.`,
  },
  {
    title: "A Beginner's Guide to Meta Business Suite",
    text: `Managing a Facebook page and an Instagram account used to mean switching between two entirely separate apps, each with its own inbox, its own scheduling tools, and its own way of showing performance data. Meta Business Suite was built to bring much of that management into a single place, and learning its basic layout can save a small business owner a meaningful amount of time each week.

The heart of the tool is a unified view across connected accounts. Rather than logging into Facebook to check messages and then separately logging into Instagram to check comments, a business owner can generally see activity from both platforms in one dashboard. This is particularly useful for a small team, or a single person managing marketing alongside many other responsibilities, because it reduces the number of places they need to check throughout the day.

Content planning is another core function. Instead of posting in the moment, a business can draft posts ahead of time and schedule them to publish automatically at a chosen date and time. This matters because consistency, discussed elsewhere as a key ingredient of audience building, becomes far easier to maintain when posts do not depend on someone remembering to publish them manually at the right moment. A week's worth of content can be prepared in a single sitting and then left to publish on its own schedule.

The inbox and comment management features bring messages and comments from connected accounts into a single stream, which helps a business respond more quickly and avoid missing a question or complaint buried in a separate app. Faster response times tend to correlate with higher customer satisfaction, since people messaging a business generally expect a reasonably prompt reply, not a delay of several days.

Insights, the performance reporting section, gives a business a general sense of how its content and any paid campaigns are performing, including which posts are generating the most engagement and how an audience is growing or changing over time. For a beginner, the most useful habit is not trying to absorb every available metric at once, but instead checking in regularly enough to notice patterns, such as which types of posts tend to perform better than others.

Like most business tools, Meta Business Suite rewards a bit of upfront setup time. Connecting accounts properly, organizing any team members with appropriate access, and taking a few minutes to explore each section before relying on it heavily will save confusion later. Once set up, it becomes less a tool to learn and more a quiet piece of daily infrastructure sitting behind a business's social media presence.

A mobile version of the tool extends this convenience beyond the desk, letting a business owner check messages, approve a scheduled post, or glance at recent performance while away from a computer. For many small business owners juggling marketing alongside daily operations, this mobile access is often what makes consistent, timely engagement with customers realistically possible in the first place, rather than something perpetually postponed until there is time to sit down at a desk.`,
  },
  {
    title: "Ad Creative Best Practices for Meta Campaigns",
    text: `Even the most precisely targeted advertising campaign will underperform if the actual ad, the image, video, and words a person sees, fails to capture attention or communicate clearly. Creative is often the single most influential factor in whether a campaign succeeds, and a handful of general principles tend to separate ads that perform well from those that quietly waste a budget.

The first few seconds or the first glance matter enormously. People scrolling through a feed make near instant decisions about whether to keep looking at something or move on, so an ad needs to communicate its core idea almost immediately. This might mean leading with a clear visual rather than burying the point in text, or opening a video with something that creates curiosity rather than a slow, generic introduction.

Clarity tends to outperform cleverness, especially for businesses without a large existing brand reputation to lean on. An ad that clearly shows what a product is, what it does, and why someone might want it will generally perform better than an ad built around a clever concept that requires the viewer to work to understand the message. This does not mean creativity has no place; it means creativity should serve clarity rather than replace it.

Relevance to the platform and format also matters a great deal. Content that looks like a native, organic post tends to blend more naturally into a feed and can feel less like an interruption than content that looks obviously like a traditional advertisement. This is part of why many businesses now favor a more casual, authentic visual style over highly polished, studio quality production, particularly for platforms where users expect informal, everyday content.

Testing multiple creative variations is one of the most reliable ways to improve performance over time. Rather than guessing which image, headline, or video will work best, running a small number of variations simultaneously and observing which ones perform better provides real evidence to guide future decisions. Over time, this kind of testing builds a much clearer picture of what resonates with a specific audience than intuition alone ever could.

Finally, creative fatigue is a real and underappreciated risk. Even a genuinely strong ad will eventually lose effectiveness if the same audience sees it too many times, because familiarity breeds indifference rather than continued interest. Refreshing creative periodically, even with relatively small changes, helps sustain performance and keeps a campaign from quietly declining simply because its audience has grown tired of seeing the same thing again and again.

The words accompanying an ad matter just as much as the image or video, even though they often receive less attention during planning. Short, direct copy that states a clear benefit tends to outperform long, vague descriptions, especially in a feed environment where people are moving quickly and reading only a fraction of what is in front of them. A strong headline paired with a specific, concrete reason to act is usually worth more than an entire paragraph of general description.`,
  },
  {
    title: "Budgeting, Bidding, and Measuring Meta Campaign Performance",
    text: `Spending money on advertising without a clear plan for how much to spend or how to judge whether it worked is one of the most common mistakes made by businesses new to paid social media. Budgeting, bidding, and measurement are three connected pieces of the same puzzle, and understanding how they fit together turns advertising from a gamble into a manageable, improvable process.

Budgeting starts with a basic question: how much can a business afford to spend, and over what period of time. Advertising platforms generally allow either a daily budget, which sets a consistent pace of spending, or a lifetime budget, which sets a total amount to be spent across the life of a campaign, with the system managing the pacing. Neither option is inherently better; the right choice depends on whether a business needs predictable daily spending or more flexibility to let the system spend faster on days when performance is strongest.

Bidding determines how a budget actually gets spent within an auction system, where advertisers are effectively competing for the attention of the same audience. Many platforms offer automated bidding strategies that aim to get the best possible results for a given budget without requiring an advertiser to manually set a specific bid amount. This tends to work well for beginners, since it removes a layer of complexity, though more experienced advertisers sometimes prefer manual control once they have enough data to make informed decisions about how much a particular outcome is genuinely worth to their business.

Measurement closes the loop and is arguably the most important piece, because it turns spending into learning. A business needs to decide, before a campaign launches, what success actually looks like. For some, this is a certain number of website visits at an acceptable cost. For others, it is a specific number of completed purchases or leads generated at a cost that still leaves room for profit once the cost of the product or service is accounted for.

Cost per result, the amount spent to achieve one meaningful outcome, is one of the most useful numbers to track over time, because it can be compared across different campaigns, audiences, and creative approaches. A campaign that costs more per result than the value it generates is not sustainable, no matter how many impressions or clicks it produces along the way, since impressions and clicks alone do not pay the bills.

The businesses that grow most confident with paid social advertising are rarely the ones who guessed correctly on their first attempt. They are the ones who treated their early campaigns as a source of data, adjusted their budgets and targeting based on what that data showed, and kept refining their approach one measured step at a time.`,
  },
];

export const metaMarketingPassages: ExamPassage[] = ARTICLES.map((a, i) => ({
  id: `en-meta-marketing-${String(i + 1).padStart(3, "0")}`,
  language: "en" as const,
  category: "Meta Marketing",
  title: a.title,
  wordCount: wc(a.text),
  text: a.text,
}));
