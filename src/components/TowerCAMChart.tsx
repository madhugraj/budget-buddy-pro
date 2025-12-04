import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface TowerCAMChartProps {
    data: Array<{
        tower: string;
        paid_flats: number;
        pending_flats: number;
        total_flats: number;
        payment_rate: string | number;
    }>;
}

export function TowerCAMChart({ data }: TowerCAMChartProps) {
    // Color based on payment rate
    const getColor = (rate: string | number) => {
        const numRate = typeof rate === 'string' ? parseFloat(rate) : rate;
        if (numRate >= 90) return '#10b981'; // Green - excellent
        if (numRate >= 75) return '#3b82f6'; // Blue - good
        if (numRate >= 50) return '#f59e0b'; // Orange - moderate
        return '#ef4444'; // Red - poor
    };

    return (
        <Card className="border-none shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Tower-wise CAM Collection
                </CardTitle>
                <CardDescription>Payment status across all towers</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="tower"
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            tick={{ fontSize: 12 }}
                        />
                        <YAxis
                            label={{ value: 'Number of Flats', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                                            <p className="font-bold text-lg mb-2">Tower {data.tower}</p>
                                            <p className="text-green-600">Paid: {data.paid_flats} flats</p>
                                            <p className="text-orange-600">Pending: {data.pending_flats} flats</p>
                                            <p className="text-gray-600">Total: {data.total_flats} flats</p>
                                            <p className="font-semibold mt-2">Payment Rate: {data.payment_rate}%</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend />
                        <Bar dataKey="paid_flats" name="Paid Flats" stackId="a">
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getColor(entry.payment_rate)} />
                            ))}
                        </Bar>
                        <Bar dataKey="pending_flats" name="Pending Flats" stackId="a" fill="#f87171" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
