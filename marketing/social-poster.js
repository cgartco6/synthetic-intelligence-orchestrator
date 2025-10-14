const { TwitterApi } = require('twitter-api-v2');
const { FacebookApi } = require('facebook-nodejs-business-sdk');
const Instagram = require('instagram-api.js');
const TikTokApi = require('tiktok-api');
const axios = require('axios');

class SocialMediaAutoPoster {
    constructor() {
        this.initApis();
        this.postingSchedule = this.generatePostingSchedule();
    }

    initApis() {
        // Twitter/X API
        this.twitterClient = new TwitterApi({
            appKey: process.env.TWITTER_API_KEY,
            appSecret: process.env.TWITTER_API_SECRET,
            accessToken: process.env.TWITTER_ACCESS_TOKEN,
            accessSecret: process.env.TWITTER_ACCESS_SECRET
        });

        // Facebook API
        this.facebookClient = FacebookApi.init(process.env.FACEBOOK_ACCESS_TOKEN);

        // TikTok API (using real TikTok Business API)
        this.tiktokClient = new TikTokApi({
            clientKey: process.env.TIKTOK_CLIENT_KEY,
            clientSecret: process.env.TIKTOK_CLIENT_SECRET
        });

        // Instagram Basic Display API
        this.instagramClient = Instagram;
    }

    async generateMarketingContent() {
        const contentTemplates = [
            {
                platform: 'tiktok',
                template: "🚀 Just generated {task_type} with AI! {result_preview}... 🤖 Try it free: {app_url} #AI #Tech #Innovation",
                hashtags: ['#AI', '#Tech', '#Innovation', '#ArtificialIntelligence', '#Future']
            },
            {
                platform: 'instagram',
                template: "✨ Amazing AI-generated {task_type}! ✨\n\n{result_preview}\n\nCreate your own with our free AI platform! 👇\n{app_url}\n\n{hashtags}",
                hashtags: ['#AICreativity', '#TechInnovation', '#DigitalTransformation', '#AICommunity']
            },
            {
                platform: 'twitter',
                template: "Just used AI to {task_description}. The results are incredible! 🤯\n\nTry it yourself - free tier available!\n\n{app_url}\n\n{hashtags}",
                hashtags: ['#AI', '#MachineLearning', '#Innovation', '#Tech']
            }
        ];

        return contentTemplates;
    }

    async postToAllPlatforms(content) {
        const results = [];
        
        try {
            // Post to TikTok
            const tiktokResult = await this.postToTikTok(content);
            results.push({ platform: 'tiktok', success: true, data: tiktokResult });
        } catch (error) {
            results.push({ platform: 'tiktok', success: false, error: error.message });
        }

        try {
            // Post to Instagram
            const instagramResult = await this.postToInstagram(content);
            results.push({ platform: 'instagram', success: true, data: instagramResult });
        } catch (error) {
            results.push({ platform: 'instagram', success: false, error: error.message });
        }

        try {
            // Post to Twitter/X
            const twitterResult = await this.postToTwitter(content);
            results.push({ platform: 'twitter', success: true, data: twitterResult });
        } catch (error) {
            results.push({ platform: 'twitter', success: false, error: error.message });
        }

        try {
            // Post to Facebook
            const facebookResult = await this.postToFacebook(content);
            results.push({ platform: 'facebook', success: true, data: facebookResult });
        } catch (error) {
            results.push({ platform: 'facebook', success: false, error: error.message });
        }

        return results;
    }

    async postToTikTok(content) {
        // Using TikTok Business API for posting
        const response = await this.tiktokClient.post('/video/publish', {
            video: content.mediaUrl,
            description: content.text,
            privacy_level: 'PUBLIC_TO_EVERYONE'
        });
        
        return response.data;
    }

    async postToInstagram(content) {
        // Instagram Basic Display API implementation
        const response = await axios.post(`https://graph.instagram.com/me/media`, {
            image_url: content.mediaUrl,
            caption: content.text,
            access_token: process.env.INSTAGRAM_ACCESS_TOKEN
        });
        
        return response.data;
    }

    async postToTwitter(content) {
        const tweet = await this.twitterClient.v2.tweet(content.text);
        return tweet.data;
    }

    async postToFacebook(content) {
        const response = await this.facebookClient.api(`/me/feed`, 'POST', {
            message: content.text,
            link: content.appUrl,
            access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN
        });
        
        return response;
    }

    startAutoPosting() {
        // Post every 6 hours
        setInterval(async () => {
            const content = await this.generateDynamicContent();
            await this.postToAllPlatforms(content);
        }, 6 * 60 * 60 * 1000);
    }
}

module.exports = SocialMediaAutoPoster;
