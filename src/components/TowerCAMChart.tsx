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
        if (numRate >= 90) return '#22c55e'; // Green - excellent
        if (numRate >= 75) return '#84cc16'; // Light green - good
        if (numRate >= 50) return '#eab308'; // Yellow - moderate
        return '#ef4444'; // Red - poor
    };

    return (
        <Card className="border-none shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl font-bold">Tower-wise CAM Collection (Latest Month)</CardTitle>
                <CardDescription>Current payment status per tower</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 50 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="tower"
                            angle={-45}
                            textAnchor="end"
                            height={70}
                            tick={{ fontSize: 10 }}
                        />
                        <YAxis
                            tick={{ fontSize: 10 }}
                            label={{ value: 'Flats', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-popover p-3 border border-border rounded-lg shadow-lg">
                                            <p className="font-bold mb-1">Tower {data.tower}</p>
                                            <p className="text-green-600 text-sm">Paid: {data.paid_flats}</p>
                                            <p className="text-red-600 text-sm">Pending: {data.pending_flats}</p>
                                            <p className="text-muted-foreground text-sm">Total: {data.total_flats}</p>
                                            <p className="font-semibold text-sm mt-1">Rate: {data.payment_rate}%</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="paid_flats" name="Paid" stackId="a">
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getColor(entry.payment_rate)} />
                            ))}
                        </Bar>
                        <Bar dataKey="pending_flats" name="Pending" stackId="a" fill="#ef4444" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
