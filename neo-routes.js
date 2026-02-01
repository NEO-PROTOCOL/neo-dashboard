
import express from 'express';
import { NeoSkillsRegistry } from './src/neo/registry/index.ts';

const router = express.Router();

// Get NEO Registry Status
router.get('/registry', async (req, res) => {
    try {
        const registry = new NeoSkillsRegistry();
        const index = await registry.getIndex();

        // Handling potential missing index
        if (!index) {
            return res.json({
                success: true,
                indexCID: null,
                totalSkills: 0,
                skills: [],
                status: 'Initial State (No Index Found)'
            });
        }

        const indexCID = await registry.getIndexCID();

        const skills = Object.entries(index.skills || {}).map(([id, data]) => ({
            id,
            latest: data.latest,
            versions: Object.keys(data.versions).length,
            versionList: Object.keys(data.versions)
        }));

        res.json({
            success: true,
            indexCID,
            totalSkills: skills.length,
            skills,
            updatedAt: index.updatedAt
        });
    } catch (error) {
        console.error('Error fetching NEO registry:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get NEO Skills List (Installed)
router.get('/skills', async (req, res) => {
    try {
        const registry = new NeoSkillsRegistry();
        const skills = await registry.list();

        res.json({
            success: true,
            skills: skills.map(skill => ({
                id: skill.id,
                name: skill.name,
                version: skill.version,
                author: skill.author,
                category: skill.category,
                cid: skill.cid,
                cid: skill.cid,
                description: skill.description || skill.metadata?.description || 'No description provided'
            }))
        });
    } catch (error) {
        console.error('Error listing NEO skills:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Search Skills (Placeholder for future implementation)
router.get('/search', async (req, res) => {
    res.json({
        success: true,
        results: [],
        message: "Search functionality coming in Phase 2.1"
    });
});

export default router;
